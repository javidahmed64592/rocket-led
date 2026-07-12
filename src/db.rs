use rocket::{Build, Rocket, fairing};
use rocket_db_pools::{Database, sqlx};

#[derive(Database)]
#[database("users_db")]
pub struct UsersDb(sqlx::SqlitePool);

#[derive(Database)]
#[database("app_db")]
pub struct AppDb(sqlx::SqlitePool);

pub async fn create_app_db_table(
    rocket: Rocket<Build>,
    table_name: &str,
    columns: &str,
) -> fairing::Result {
    match AppDb::fetch(&rocket) {
        Some(db) => {
            let result = sqlx::query(&format!(
                "CREATE TABLE IF NOT EXISTS {} ({})",
                table_name, columns
            ))
            .execute(&**db)
            .await;

            match result {
                Ok(_) => Ok(rocket),
                Err(e) => {
                    error!("Failed to initialize app_db: {}", e);
                    Err(rocket)
                }
            }
        }
        None => Err(rocket),
    }
}

pub fn ensure_users_db_exists() {
    let figment = rocket::Config::figment();
    let url: String = figment
        .extract_inner("databases.users_db.url")
        .expect("set databases.users_db.url in Rocket.toml or ROCKET_DATABASES env var");

    let path = url
        .trim_start_matches("file:")
        .split('?')
        .next()
        .unwrap_or(&url);

    if !std::path::Path::new(path).exists() {
        eprintln!(
            "Users database not found at '{}'.\nRun the create-user tool first to create it.",
            path
        );
        std::process::exit(1);
    }
}
