use rocket::serde::json::Json;
use rocket::{Route, delete, get, post, routes};
use rocket_db_pools::{Connection, sqlx};
use rocket_led::PinMapping;
use serde::{Deserialize, Serialize};

use crate::AppDb;

/// New pin mapping data
#[derive(Deserialize)]
pub struct NewPinMapping {
    pub name: String,
    pub red_pin: u8,
    pub green_pin: u8,
    pub blue_pin: u8,
}

#[derive(Serialize)]
pub struct ApiError {
    pub message: String,
}

#[get("/mappings")]
async fn list_mappings(mut db: Connection<AppDb>) -> Result<Json<Vec<PinMapping>>, Json<ApiError>> {
    let rows = sqlx::query_as::<_, PinMapping>(
        "SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings",
    )
    .fetch_all(&mut **db)
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?;

    Ok(Json(rows))
}

#[post("/mappings", data = "<mapping>")]
async fn create_mapping(
    mut db: Connection<AppDb>,
    mapping: Json<NewPinMapping>,
) -> Result<Json<PinMapping>, Json<ApiError>> {
    let id: i64 = sqlx::query(
        "INSERT INTO pin_mappings (name, red_pin, green_pin, blue_pin) VALUES (?, ?, ?, ?)",
    )
    .bind(&mapping.name)
    .bind(mapping.red_pin)
    .bind(mapping.green_pin)
    .bind(mapping.blue_pin)
    .execute(&mut **db)
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?
    .last_insert_rowid();

    Ok(Json(PinMapping {
        id: Some(id),
        name: mapping.name.clone(),
        red_pin: mapping.red_pin,
        green_pin: mapping.green_pin,
        blue_pin: mapping.blue_pin,
    }))
}

#[delete("/mappings/<id>")]
async fn delete_mapping(mut db: Connection<AppDb>, id: i64) -> Result<Json<()>, Json<ApiError>> {
    sqlx::query("DELETE FROM pin_mappings WHERE id = ?")
        .bind(id)
        .execute(&mut **db)
        .await
        .map_err(|e| {
            Json(ApiError {
                message: e.to_string(),
            })
        })?;

    Ok(Json(()))
}

pub fn routes() -> Vec<Route> {
    routes![list_mappings, create_mapping, delete_mapping]
}
