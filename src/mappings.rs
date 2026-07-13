use rocket::serde::json::Json;
use rocket::{Route, State, delete, get, post, routes};
use rocket_db_pools::{Connection, sqlx};
use rocket_led::{AuthenticatedUser, PinMapping, RgbColour};
use rppal::gpio::Gpio;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::AppDb;
use crate::led::LedController;

/// New pin mapping data
#[derive(Deserialize)]
pub struct NewPinMapping {
    pub name: String,
    pub red_pin: u8,
    pub green_pin: u8,
    pub blue_pin: u8,
}

#[derive(Deserialize)]
pub struct PinTestRequest {
    pub red_pin: u8,
    pub green_pin: u8,
    pub blue_pin: u8,
}

#[derive(Serialize)]
pub struct ApiError {
    pub message: String,
}

#[get("/mappings")]
async fn list_mappings(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
) -> Result<Json<Vec<PinMapping>>, Json<ApiError>> {
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
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    mapping: Json<NewPinMapping>,
) -> Result<Json<PinMapping>, Json<ApiError>> {
    // Check if any pins are already in use
    let existing: Option<PinMapping> = sqlx::query_as(
        "SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings
         WHERE red_pin = ? OR green_pin = ? OR blue_pin = ?",
    )
    .bind(mapping.red_pin)
    .bind(mapping.green_pin)
    .bind(mapping.blue_pin)
    .fetch_optional(&mut **db)
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?;

    if existing.is_some() {
        return Err(Json(ApiError {
            message: "One or more pins are already in use.".into(),
        }));
    }

    // Create the mapping
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

#[patch("/mappings/<id>", data = "<mapping>")]
async fn update_mapping(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    id: i64,
    mapping: Json<NewPinMapping>,
) -> Result<Json<PinMapping>, Json<ApiError>> {
    // Check if any pins are already in use by other mappings
    let existing: Option<PinMapping> = sqlx::query_as(
        "SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings
         WHERE (red_pin = ? OR green_pin = ? OR blue_pin = ?) AND id != ?",
    )
    .bind(mapping.red_pin)
    .bind(mapping.green_pin)
    .bind(mapping.blue_pin)
    .bind(id)
    .fetch_optional(&mut **db)
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?;

    if existing.is_some() {
        return Err(Json(ApiError {
            message: "One or more pins are already in use.".into(),
        }));
    }

    // Update the mapping
    sqlx::query(
        "UPDATE pin_mappings SET name = ?, red_pin = ?, green_pin = ?, blue_pin = ? WHERE id = ?",
    )
    .bind(&mapping.name)
    .bind(mapping.red_pin)
    .bind(mapping.green_pin)
    .bind(mapping.blue_pin)
    .bind(id)
    .execute(&mut **db)
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?;

    Ok(Json(PinMapping {
        id: Some(id),
        name: mapping.name.clone(),
        red_pin: mapping.red_pin,
        green_pin: mapping.green_pin,
        blue_pin: mapping.blue_pin,
    }))
}

#[delete("/mappings/<id>")]
async fn delete_mapping(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    id: i64,
) -> Result<Json<()>, Json<ApiError>> {
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

#[post("/mappings/test", data = "<mapping>")]
async fn test_mapping(
    _user: AuthenticatedUser,
    gpio: &State<Gpio>,
    mapping: Json<PinTestRequest>,
) -> Result<Json<()>, Json<ApiError>> {
    let temp_mapping = PinMapping {
        id: None,
        name: "test".into(),
        red_pin: mapping.red_pin,
        green_pin: mapping.green_pin,
        blue_pin: mapping.blue_pin,
    };

    let gpio: &Gpio = gpio.inner();

    rocket::tokio::task::spawn_blocking({
        let gpio = gpio.clone();
        move || -> Result<(), rppal::gpio::Error> {
            let mut controller = LedController::new(&gpio, &temp_mapping)?;

            let steps = [
                RgbColour { r: 255, g: 0, b: 0 },
                RgbColour { r: 0, g: 255, b: 0 },
                RgbColour { r: 0, g: 0, b: 255 },
                RgbColour {
                    r: 255,
                    g: 255,
                    b: 255,
                },
            ];

            for colour in steps {
                controller.set_colour(colour)?;
                std::thread::sleep(Duration::from_millis(500));
            }

            controller.off()?;
            Ok(())
        }
    })
    .await
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?
    .map_err(|e| {
        Json(ApiError {
            message: e.to_string(),
        })
    })?;

    Ok(Json(()))
}

pub fn routes() -> Vec<Route> {
    routes![
        list_mappings,
        create_mapping,
        update_mapping,
        delete_mapping,
        test_mapping
    ]
}
