#[macro_use]
extern crate rocket;

mod db;

use argon2::password_hash::PasswordVerifier;
use argon2::{Argon2, PasswordHash};
use db::{AppDb, UsersDb, create_app_db_table, ensure_users_db_exists};
use rocket::fairing::{self, AdHoc};
use rocket::fs::{FileServer, NamedFile};
use rocket::http::{Cookie, CookieJar, Status};
use rocket::serde::Serialize;
use rocket::serde::json::Json;
use rocket_db_pools::{Connection, Database, sqlx};
use rocket_led::{AuthenticatedUser, Credentials, static_dir};

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

#[post("/login", data = "<creds>")]
async fn login(
    creds: Json<Credentials>,
    mut db: Connection<UsersDb>,
    cookies: &CookieJar<'_>,
) -> Status {
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT username, password_hash FROM users WHERE username = ?")
            .bind(&creds.username)
            .fetch_optional(&mut **db)
            .await
            .unwrap_or(None);

    let (username, password_hash) = match row {
        Some(row) => row,
        None => return Status::Unauthorized,
    };

    let parsed_hash = match PasswordHash::new(&password_hash) {
        Ok(hash) => hash,
        Err(_) => return Status::InternalServerError,
    };

    match Argon2::default().verify_password(creds.password.as_bytes(), &parsed_hash) {
        Ok(()) => {
            cookies.add_private(Cookie::new("session", username));
            Status::Ok
        }
        Err(_) => Status::Unauthorized,
    }
}

#[post("/logout")]
fn logout(cookies: &CookieJar<'_>) -> Status {
    cookies.remove_private("session");
    Status::Ok
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

    rocket::build()
        .attach(UsersDb::init())
        .attach(AppDb::init())
        .attach(AdHoc::try_on_ignite("App DB Init", init_app_db))
        .mount("/api", routes![health, login, logout, protected])
        .mount("/", FileServer::from(static_dir()).rank(10))
        .mount("/", routes![spa_fallback])
}
