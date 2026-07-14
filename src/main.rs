#[macro_use]
extern crate rocket;

mod auth;
mod db;
mod led;
mod mappings;
mod presets;

use db::{AppDb, UsersDb, create_app_db_table, ensure_users_db_exists};
use led::{LedRuntime, spawn_led_task};
use rocket::fairing::{self, AdHoc};
use rocket::fs::{FileServer, NamedFile};
use rocket::serde::Serialize;
use rocket::serde::json::Json;
use rocket_db_pools::Database;
use rocket_led::{AuthenticatedUser, static_dir};
use rppal::gpio::Gpio;
use std::sync::Arc;
use tokio::sync::OnceCell;

type LedRuntimeCell = Arc<OnceCell<LedRuntime>>;

async fn init_app_db(rocket: rocket::Rocket<rocket::Build>) -> fairing::Result {
    let rocket = create_app_db_table(
        rocket,
        "pin_mappings",
        "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, red_pin INTEGER NOT NULL, green_pin INTEGER NOT NULL, blue_pin INTEGER NOT NULL",
    )
    .await?;

    let rocket = create_app_db_table(
        rocket,
        "presets",
        "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pattern_kind TEXT NOT NULL, colours_json TEXT NOT NULL, interval_ms INTEGER NOT NULL",
    )
    .await?;

    let rocket = create_app_db_table(
        rocket,
        "schedules",
        "id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, days_of_week_json TEXT NOT NULL, preset_id INTEGER NOT NULL REFERENCES presets(id), enabled INTEGER NOT NULL DEFAULT 1",
    )
    .await?;

    let rocket = create_app_db_table(
        rocket,
        "active_state",
        "id INTEGER PRIMARY KEY CHECK (id = 1), preset_id INTEGER REFERENCES presets(id), source TEXT NOT NULL DEFAULT 'manual'",
    )
    .await?;

    Ok(rocket)
}

#[derive(Serialize)]
struct Message {
    message: String,
}

#[get("/health")]
fn health() -> &'static str {
    "OK"
}

#[get("/protected")]
fn protected(user: AuthenticatedUser) -> Json<Message> {
    Json(Message {
        message: format!("Hello, {}! This is protected data.", user.username),
    })
}

#[get("/<_..>", rank = 20)]
async fn spa_fallback() -> Option<NamedFile> {
    NamedFile::open(static_dir().join("index.html")).await.ok()
}

#[launch]
fn rocket() -> _ {
    ensure_users_db_exists();

    let led_cell: LedRuntimeCell = Arc::new(OnceCell::new());
    let led_cell_for_liftoff = led_cell.clone();

    let gpio = Gpio::new().expect("failed to initialise GPIO");

    rocket::build()
        .manage(gpio)
        .manage(led_cell)
        .attach(UsersDb::init())
        .attach(AppDb::init())
        .attach(AdHoc::try_on_ignite("App DB Init", init_app_db))
        .attach(AdHoc::on_liftoff("LED Task", move |rocket| {
            let led_cell = led_cell_for_liftoff.clone();
            Box::pin(async move {
                let pool = (**AppDb::fetch(rocket).expect("AppDb not attached")).clone();
                let gpio = Gpio::new().expect("failed to initialise GPIO for LED task");
                let runtime = spawn_led_task(gpio, pool);
                let _ = led_cell.set(runtime);
            })
        }))
        .mount("/api", routes![health, protected])
        .mount("/api", auth::routes())
        .mount("/api", mappings::routes())
        .mount("/api", presets::routes())
        .mount("/", FileServer::from(static_dir()).rank(10))
        .mount("/", routes![spa_fallback])
}
