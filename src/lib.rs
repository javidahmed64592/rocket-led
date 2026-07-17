use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket_db_pools::sqlx;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// Authentication

/// Path to static directory
pub fn static_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/static"))
    } else {
        std::env::current_exe()
            .expect("failed to get current exe path")
            .parent()
            .expect("exe has no parent dir")
            .join("static")
    }
}

/// Credentials for login
#[derive(Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

/// Authenticated user
pub struct AuthenticatedUser {
    pub username: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedUser {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match req.cookies().get_private("session") {
            Some(cookie) => Outcome::Success(AuthenticatedUser {
                username: cookie.value().to_string(),
            }),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

// LED control

/// Colour: 8-bit per channel
#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct RgbColour {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// Pattern kind
#[derive(Serialize, Deserialize, Clone, Copy, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LedPatternKind {
    /// No output
    Off,
    /// Single colour, ignores interval
    Solid,
    /// Fade in/out of single colour
    Pulse,
    /// Alternate colour(s) on/off
    Blink,
    /// Fade through list of colours
    Gradient,
    /// Computed HSV cycle, ignores colour list
    Rainbow,
}

/// LED pattern data
#[derive(Serialize, Deserialize, Clone)]
pub struct LedPattern {
    /// Pattern kind
    pub kind: LedPatternKind,
    /// List of colours to use for the pattern (if applicable)
    pub colours: Vec<RgbColour>,
    /// Interval in milliseconds for one full cycle of the pattern
    pub interval_ms: u32,
}

/// LED preset data
#[derive(Serialize, Deserialize, Clone)]
pub struct LedPreset {
    /// Database ID
    pub id: Option<i64>,
    /// Name of the preset
    pub name: String,
    /// Pattern data
    pub pattern: LedPattern,
}

/// LED schedule data
#[derive(Serialize, Deserialize, Clone)]
pub struct LedSchedule {
    /// Database ID
    pub id: Option<i64>,
    /// Label for the schedule
    pub label: String,
    /// Start time in "HH:MM" format, local time
    pub start_time: String,
    /// End time in "HH:MM" format, local time
    pub end_time: String,
    /// Days of the week for the schedule (0=Mon..6=Sun, or empty = every day)
    pub days_of_week: Vec<u8>,
    /// ID of the preset to use
    pub preset_id: i64,
    /// Whether the schedule is enabled
    pub enabled: bool,
}

/// Pin mapping data
#[derive(Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct PinMapping {
    /// Database ID
    pub id: Option<i64>,
    /// Name of the pin mapping (e.g. "Desk LED")
    pub name: String,
    /// BCM pin number for the red channel
    pub red_pin: u8,
    /// BCM pin number for the green channel
    pub green_pin: u8,
    /// BCM pin number for the blue channel
    pub blue_pin: u8,
}
