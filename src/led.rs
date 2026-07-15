use rocket::log::private::error;
use rocket_led::{LedPattern, LedPatternKind, PinMapping, RgbColour};
use rppal::gpio::{Gpio, OutputPin};
use std::time::{Duration, Instant};
use tokio::sync::watch;

/// LED controller
pub struct LedController {
    /// Red pin
    red: OutputPin,
    /// Green pin
    green: OutputPin,
    /// Blue pin
    blue: OutputPin,
}

impl LedController {
    /// Create a new LED controller from a GPIO instance and a pin mapping
    pub fn new(gpio: &Gpio, mapping: &PinMapping) -> Result<Self, rppal::gpio::Error> {
        Ok(Self {
            red: gpio.get(mapping.red_pin as u8)?.into_output(),
            green: gpio.get(mapping.green_pin as u8)?.into_output(),
            blue: gpio.get(mapping.blue_pin as u8)?.into_output(),
        })
    }

    /// Calculate PWM value from 8-bit colour value
    fn calculate_pwm_value(value: u8) -> f64 {
        value as f64 / 255.0
    }

    /// Set the colour of the LED
    pub fn set_colour(&mut self, c: RgbColour) -> Result<(), rppal::gpio::Error> {
        // Correction gains to compensate for channel brightness differences on cheap RGB LEDs.
        // Green and blue dies are typically brighter than red at the same duty cycle, so mixed
        // colours (e.g. orange) skew green/blue without these adjustments. Tune by eye.
        const GREEN_GAIN: f64 = 0.3;
        const BLUE_GAIN: f64 = 0.9;

        self.red
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.r))?;
        self.green
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.g) * GREEN_GAIN)?;
        self.blue
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.b) * BLUE_GAIN)?;
        Ok(())
    }

    /// Turn off the LED
    pub fn off(&mut self) -> Result<(), rppal::gpio::Error> {
        self.set_colour(RgbColour { r: 0, g: 0, b: 0 })
    }
}

/// Command sent to the LED task
#[derive(Clone)]
pub enum LedCommand {
    /// Turn off all LEDs
    Off,
    /// Apply a pattern to all LEDs
    ApplyPattern(LedPattern),
}

/// Handle stored in Rocket managed state; HTTP handlers use this to talk to the task.
#[derive(Clone)]
pub struct LedRuntime {
    pub tx: watch::Sender<LedCommand>,
}

/// Spawned once at launch. `pool` is a plain sqlx pool (not a request-scoped Connection),
/// since this task outlives any single request.
pub fn spawn_led_task(gpio: Gpio, pool: sqlx::SqlitePool) -> LedRuntime {
    let (tx, mut rx) = watch::channel(LedCommand::Off);
    let runtime = LedRuntime { tx };

    tokio::spawn(async move {
        let mut controllers: Vec<LedController> = Vec::new();
        let mut current = LedCommand::Off;
        let mut pattern_start = Instant::now();
        let mut ticker = tokio::time::interval(Duration::from_millis(20));

        loop {
            tokio::select! {
                changed = rx.changed() => {
                    if changed.is_err() { break; } // sender dropped, shut down
                    current = rx.borrow().clone();
                    pattern_start = Instant::now();

                    // Turn old LEDs off and release their GPIO lines *before* claiming
                    // pins for the new pattern — otherwise the new claim fails because
                    // the old OutputPins haven't been dropped yet.
                    for c in controllers.iter_mut() {
                        let _ = c.off();
                    }
                    controllers.clear();

                    if let LedCommand::ApplyPattern(_) = &current {
                        controllers = rebuild_controllers(&gpio, &pool).await;
                    }
                }
                _ = ticker.tick() => {
                    if let LedCommand::ApplyPattern(pattern) = &current {
                        let colour = compute_colour(pattern, pattern_start.elapsed());
                        for c in controllers.iter_mut() {
                            let _ = c.set_colour(colour);
                        }
                    }
                }
            }
        }
    });

    runtime
}

async fn rebuild_controllers(gpio: &Gpio, pool: &sqlx::SqlitePool) -> Vec<LedController> {
    let mappings: Vec<PinMapping> =
        sqlx::query_as("SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    mappings
        .iter()
        .filter_map(|m| match LedController::new(gpio, m) {
            Ok(c) => Some(c),
            Err(e) => {
                error!("failed to claim pins for mapping '{}': {}", m.name, e);
                None
            }
        })
        .collect()
}

/// Pure function: given a pattern and elapsed time since it was applied, what colour right now?
fn compute_colour(pattern: &LedPattern, elapsed: Duration) -> RgbColour {
    let black = RgbColour { r: 0, g: 0, b: 0 };
    let cycle_ms = pattern.interval_ms.max(1) as u128;
    let t = elapsed.as_millis() % cycle_ms;
    let frac = t as f64 / cycle_ms as f64; // 0.0..1.0 position within the current cycle

    match pattern.kind {
        LedPatternKind::Off => black,

        LedPatternKind::Solid => pattern.colours.first().copied().unwrap_or(black),

        LedPatternKind::Pulse => {
            let base = pattern.colours.first().copied().unwrap_or(black);
            // sine-ish triangle wave 0..1..0 over one cycle
            let brightness = 1.0 - (2.0 * frac - 1.0).abs();
            scale(base, brightness)
        }

        LedPatternKind::Blink => {
            let base = pattern.colours.first().copied().unwrap_or(black);
            if frac < 0.5 { base } else { black }
        }

        LedPatternKind::Gradient => {
            if pattern.colours.is_empty() {
                return black;
            }
            let n = pattern.colours.len();
            let pos = frac * n as f64;
            let idx = pos.floor() as usize % n;
            let next_idx = (idx + 1) % n;
            let local_frac = pos.fract();
            lerp(pattern.colours[idx], pattern.colours[next_idx], local_frac)
        }

        LedPatternKind::Rainbow => hsv_to_rgb(frac * 360.0, 1.0, 1.0),
    }
}

fn scale(c: RgbColour, factor: f64) -> RgbColour {
    RgbColour {
        r: (c.r as f64 * factor).round() as u8,
        g: (c.g as f64 * factor).round() as u8,
        b: (c.b as f64 * factor).round() as u8,
    }
}

fn lerp(a: RgbColour, b: RgbColour, t: f64) -> RgbColour {
    RgbColour {
        r: (a.r as f64 + (b.r as f64 - a.r as f64) * t).round() as u8,
        g: (a.g as f64 + (b.g as f64 - a.g as f64) * t).round() as u8,
        b: (a.b as f64 + (b.b as f64 - a.b as f64) * t).round() as u8,
    }
}

fn hsv_to_rgb(h: f64, s: f64, v: f64) -> RgbColour {
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = v - c;
    let (r1, g1, b1) = match h as u32 {
        0..=59 => (c, x, 0.0),
        60..=119 => (x, c, 0.0),
        120..=179 => (0.0, c, x),
        180..=239 => (0.0, x, c),
        240..=299 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    RgbColour {
        r: ((r1 + m) * 255.0).round() as u8,
        g: ((g1 + m) * 255.0).round() as u8,
        b: ((b1 + m) * 255.0).round() as u8,
    }
}
