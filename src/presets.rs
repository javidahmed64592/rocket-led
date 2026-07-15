use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State, delete, get, post, routes};
use rocket_db_pools::{Connection, sqlx};
use rocket_led::{AuthenticatedUser, LedPattern, LedPatternKind, LedPreset};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::OnceCell;

use crate::AppDb;
use crate::led::{LedCommand, LedRuntime};

type LedRuntimeCell = Arc<OnceCell<LedRuntime>>;

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

#[derive(Serialize)]
pub struct ActiveStateResponse {
    pub preset_id: Option<i64>,
    pub preset_name: Option<String>,
    pub source: String,
}

#[get("/presets")]
async fn list_presets(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
) -> Result<Json<Vec<LedPreset>>, (Status, Json<ApiError>)> {
    let rows: Vec<(i64, String, String, String, u32)> =
        sqlx::query_as("SELECT id, name, pattern_kind, colours_json, interval_ms FROM presets")
            .fetch_all(&mut **db)
            .await
            .map_err(err)?;

    let presets = rows
        .into_iter()
        .map(|(id, name, kind_str, colours_json, interval_ms)| {
            let kind: LedPatternKind =
                serde_json::from_str(&format!("\"{kind_str}\"")).unwrap_or(LedPatternKind::Off);
            let colours = serde_json::from_str(&colours_json).unwrap_or_default();
            LedPreset {
                id: Some(id),
                name,
                pattern: LedPattern {
                    kind,
                    colours,
                    interval_ms,
                },
            }
        })
        .collect();

    Ok(Json(presets))
}

#[post("/presets", data = "<preset>")]
async fn create_preset(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    preset: Json<LedPreset>,
) -> Result<Json<LedPreset>, (Status, Json<ApiError>)> {
    let kind_str = serde_json::to_string(&preset.pattern.kind)
        .map_err(err)?
        .trim_matches('"')
        .to_string();
    let colours_json = serde_json::to_string(&preset.pattern.colours).map_err(err)?;

    let id: i64 = sqlx::query(
        "INSERT INTO presets (name, pattern_kind, colours_json, interval_ms) VALUES (?, ?, ?, ?)",
    )
    .bind(&preset.name)
    .bind(&kind_str)
    .bind(&colours_json)
    .bind(preset.pattern.interval_ms)
    .execute(&mut **db)
    .await
    .map_err(err)?
    .last_insert_rowid();

    Ok(Json(LedPreset {
        id: Some(id),
        name: preset.name.clone(),
        pattern: preset.pattern.clone(),
    }))
}

#[delete("/presets/<id>")]
async fn delete_preset(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    id: i64,
) -> Result<Json<()>, (Status, Json<ApiError>)> {
    sqlx::query("UPDATE active_state SET preset_id = NULL, source = 'off' WHERE preset_id = ?")
        .bind(id)
        .execute(&mut **db)
        .await
        .map_err(err)?;

    sqlx::query("DELETE FROM presets WHERE id = ?")
        .bind(id)
        .execute(&mut **db)
        .await
        .map_err(err)?;

    Ok(Json(()))
}

#[post("/presets/<id>/apply")]
async fn apply_preset(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    led_cell: &State<LedRuntimeCell>,
    id: i64,
) -> Result<Json<()>, (Status, Json<ApiError>)> {
    let row: Option<(String, String, u32)> =
        sqlx::query_as("SELECT pattern_kind, colours_json, interval_ms FROM presets WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut **db)
            .await
            .map_err(err)?;

    let Some((kind_str, colours_json, interval_ms)) = row else {
        return Err((
            Status::NotFound,
            Json(ApiError {
                message: "Preset not found".into(),
            }),
        ));
    };

    let kind: LedPatternKind = serde_json::from_str(&format!("\"{kind_str}\"")).map_err(err)?;
    let colours = serde_json::from_str(&colours_json).map_err(err)?;
    let pattern = LedPattern {
        kind,
        colours,
        interval_ms,
    };

    let runtime = led_cell.get().ok_or_else(|| {
        (
            Status::InternalServerError,
            Json(ApiError {
                message: "LED task not ready".into(),
            }),
        )
    })?;
    runtime
        .tx
        .send(LedCommand::ApplyPattern(pattern))
        .map_err(err)?;

    sqlx::query(
        "INSERT INTO active_state (id, preset_id, source) VALUES (1, ?, 'manual')
         ON CONFLICT(id) DO UPDATE SET preset_id = excluded.preset_id, source = 'manual'",
    )
    .bind(id)
    .execute(&mut **db)
    .await
    .map_err(err)?;

    Ok(Json(()))
}

#[post("/state/off")]
async fn turn_off(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
    led_cell: &State<LedRuntimeCell>,
) -> Result<Json<()>, (Status, Json<ApiError>)> {
    let runtime = led_cell.get().ok_or_else(|| {
        (
            Status::InternalServerError,
            Json(ApiError {
                message: "LED task not ready".into(),
            }),
        )
    })?;
    runtime.tx.send(LedCommand::Off).map_err(err)?;

    sqlx::query(
        "INSERT INTO active_state (id, preset_id, source) VALUES (1, NULL, 'off')
         ON CONFLICT(id) DO UPDATE SET preset_id = NULL, source = 'off'",
    )
    .execute(&mut **db)
    .await
    .map_err(err)?;

    Ok(Json(()))
}

#[get("/state")]
async fn get_state(
    _user: AuthenticatedUser,
    mut db: Connection<AppDb>,
) -> Result<Json<ActiveStateResponse>, (Status, Json<ApiError>)> {
    let row: Option<(Option<i64>, String)> =
        sqlx::query_as("SELECT preset_id, source FROM active_state WHERE id = 1")
            .fetch_optional(&mut **db)
            .await
            .map_err(err)?;

    let (preset_id, source) = row.unwrap_or((None, "off".to_string()));

    let preset_name = if let Some(pid) = preset_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM presets WHERE id = ?")
            .bind(pid)
            .fetch_optional(&mut **db)
            .await
            .map_err(err)?
    } else {
        None
    };

    Ok(Json(ActiveStateResponse {
        preset_id,
        preset_name,
        source,
    }))
}

pub fn routes() -> Vec<Route> {
    routes![
        list_presets,
        create_preset,
        delete_preset,
        apply_preset,
        get_state,
        turn_off,
    ]
}
