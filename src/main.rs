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
use rust_base_server::{AuthenticatedUser, Credentials, static_dir};

async fn init_app_db(rocket: rocket::Rocket<rocket::Build>) -> fairing::Result {
    create_app_db_table(
        rocket,
        "app_data",
        "id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL",
    )
    .await
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
