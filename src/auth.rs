use argon2::password_hash::PasswordVerifier;
use argon2::{Argon2, PasswordHash};
use rocket::http::{Cookie, CookieJar, Status};
use rocket::serde::json::Json;
use rocket::{Route, post, routes};
use rocket_db_pools::{Connection, sqlx};
use rocket_led::Credentials;

use crate::db::UsersDb;

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

pub fn routes() -> Vec<Route> {
    routes![login, logout]
}
