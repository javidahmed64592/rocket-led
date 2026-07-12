use argon2::Argon2;
use argon2::password_hash::{PasswordHasher, SaltString, rand_core::OsRng};
use rocket_db_pools::sqlx;
use sqlx::sqlite::SqlitePoolOptions;
use std::env;

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: create-user <db-path> <username>");
        std::process::exit(1);
    }
    let db_path = &args[1];
    let username = &args[2];

    let password = rpassword::prompt_password("Password: ").expect("failed to read password");
    let confirm =
        rpassword::prompt_password("Confirm password: ").expect("failed to read password");
    if password != confirm {
        eprintln!("Passwords did not match.");
        std::process::exit(1);
    }

    // mode=rwc: create the file (and parent must already exist) if missing.
    let pool = SqlitePoolOptions::new()
        .connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await
        .expect("failed to open/create users database");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .expect("failed to create users table");

    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE username = ?")
        .bind(username)
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

    if existing > 0 {
        eprintln!("User '{}' already exists.", username);
        std::process::exit(1);
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("hashing failed")
        .to_string();

    sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username)
        .bind(&password_hash)
        .execute(&pool)
        .await
        .expect("failed to insert user");

    println!("User '{}' created in {}", username, db_path);
}
