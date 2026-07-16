use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State, delete, get, post, routes};
use rocket_db_pools::{Connection, sqlx};
use rocket_led::{AuthenticatedUser, LedPattern, LedPatternKind, PinMapping, RgbColour};
use rppal::gpio::Gpio;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;

use crate::AppDb;
use crate::led::{LedCommand, LedController, LedRuntime};

type LedRuntimeCell = Arc<OnceCell<LedRuntime>>;

/// New pin mapping data
#[derive(Deserialize)]
pub struct NewPinMapping {
    pub name: String,
    pub red_pin: u8,
    pub green_pin: u8,
    pub blue_pin: u8,
}

/// Test request — either an existing mapping by ID (suspend/restore flow),
/// or ad-hoc pins (direct test with no LED-task interaction).
#[derive(Deserialize)]
#[serde(untagged)]
pub enum TestRequest {
    ById {
        id: i64,
    },
    ByPins {
        red_pin: u8,
        green_pin: u8,
        blue_pin: u8,
    },
}

#[derive(Serialize)]
pub struct ApiError {
    pub message: String,
}

fn err(e: impl ToString) -> (Status, Json<ApiError>) {
    (
        Status::InternalServerError,
        Json(ApiError {
            message: e.to_string(),
        }),
    )
}

#[get("/mappings")]
async fn list_mappings(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
) -> Result<Json<Vec<PinMapping>>, (Status, Json<ApiError>)> {
    let rows = sqlx::query_as::<_, PinMapping>(
        "SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings",
    )
    .fetch_all(&mut **db)
    .await
    .map_err(err)?;

    Ok(Json(rows))
}

#[post("/mappings", data = "<mapping>")]
async fn create_mapping(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    mapping: Json<NewPinMapping>,
) -> Result<Json<PinMapping>, (Status, Json<ApiError>)> {
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
    .map_err(err)?;

    if existing.is_some() {
        return Err((
            Status::Conflict,
            Json(ApiError {
                message: "One or more pins are already in use.".into(),
            }),
        ));
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
    .map_err(err)?
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
) -> Result<Json<PinMapping>, (Status, Json<ApiError>)> {
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
    .map_err(err)?;

    if existing.is_some() {
        return Err((
            Status::Conflict,
            Json(ApiError {
                message: "One or more pins are already in use.".into(),
            }),
        ));
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
    .map_err(err)?;

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
) -> Result<Json<()>, (Status, Json<ApiError>)> {
    sqlx::query("DELETE FROM pin_mappings WHERE id = ?")
        .bind(id)
        .execute(&mut **db)
        .await
        .map_err(err)?;

    Ok(Json(()))
}

#[post("/mappings/test", data = "<request>")]
async fn test_mapping(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    led_cell: &State<LedRuntimeCell>,
    gpio: &State<Gpio>,
    request: Json<TestRequest>,
) -> Result<Json<()>, (Status, Json<ApiError>)> {
    // Resolve the mapping and whether we need the suspend/resume flow
    let (mapping, needs_restore) = match request.into_inner() {
        TestRequest::ById { id } => {
            let m: PinMapping = sqlx::query_as(
                "SELECT id, name, red_pin, green_pin, blue_pin FROM pin_mappings WHERE id = ?",
            )
            .bind(id)
            .fetch_one(&mut **db)
            .await
            .map_err(err)?;
            (m, true)
        }
        TestRequest::ByPins {
            red_pin,
            green_pin,
            blue_pin,
        } => (
            PinMapping {
                id: None,
                name: "test".into(),
                red_pin,
                green_pin,
                blue_pin,
            },
            false,
        ),
    };

    // If testing by ID, snapshot active state and suspend the LED task so
    // these GPIO pins are free for the blocking test below
    let runtime = if needs_restore {
        Some(led_cell.get().ok_or_else(|| err("LED task not ready"))?)
    } else {
        None
    };

    let previous: Option<(Option<i64>, String)> = if needs_restore {
        sqlx::query_as("SELECT preset_id, source FROM active_state WHERE id = 1")
            .fetch_optional(&mut **db)
            .await
            .map_err(err)?
    } else {
        None
    };

    if let Some(rt) = &runtime {
        rt.tx.send(LedCommand::Off).map_err(err)?;
        tokio::time::sleep(Duration::from_millis(150)).await;
    }

    // Run the R → G → B → White test cycle
    let gpio = gpio.inner().clone();
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
    rocket::tokio::task::spawn_blocking(move || -> Result<(), rppal::gpio::Error> {
        let mut controller = LedController::new(&gpio, &mapping)?;
        for colour in steps {
            controller.set_colour(colour)?;
            std::thread::sleep(Duration::from_millis(500));
        }
        controller.off()
    })
    .await
    .map_err(err)?
    .map_err(err)?;

    // Resume the previous pattern if we suspended it
    if let (Some(rt), Some((Some(preset_id), source))) = (runtime, previous)
        && source != "off"
    {
        let row: Option<(String, String, u32)> = sqlx::query_as(
            "SELECT pattern_kind, colours_json, interval_ms FROM presets WHERE id = ?",
        )
        .bind(preset_id)
        .fetch_optional(&mut **db)
        .await
        .map_err(err)?;

        if let Some((kind_str, colours_json, interval_ms)) = row
            && let Ok(kind) = serde_json::from_str::<LedPatternKind>(&format!("\"{kind_str}\""))
        {
            let colours = serde_json::from_str(&colours_json).unwrap_or_default();
            rt.tx
                .send(LedCommand::ApplyPattern(LedPattern {
                    kind,
                    colours,
                    interval_ms,
                }))
                .map_err(err)?;
        }
    }

    Ok(Json(()))
}

pub fn routes() -> Vec<Route> {
    routes![
        list_mappings,
        create_mapping,
        update_mapping,
        delete_mapping,
        test_mapping,
    ]
}
