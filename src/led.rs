use rppal::gpio::{Gpio, OutputPin};

use rocket_led::{PinMapping, RgbColour};

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
        self.red
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.r))?;
        self.green
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.g))?;
        self.blue
            .set_pwm_frequency(200.0, Self::calculate_pwm_value(c.b))?;
        Ok(())
    }

    /// Turn off the LED
    pub fn off(&mut self) -> Result<(), rppal::gpio::Error> {
        self.set_colour(RgbColour { r: 0, g: 0, b: 0 })
    }
}
