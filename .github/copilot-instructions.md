# Copilot Instructions for rocket-led

## Project Overview

`rocket-led` is a Rust/Rocket web application that controls RGB LEDs on a Raspberry Pi via GPIO (rppal). It exposes a REST API consumed by a React/TypeScript frontend. The backend and frontend are served together — Rocket serves the built frontend as static files.

## Architecture

### Backend (`src/`)

- **Framework**: [Rocket](https://rocket.rs/) 0.5 with `rocket_db_pools` (SQLx, SQLite)
- **GPIO**: `rppal` for hardware PWM on Raspberry Pi GPIO pins
- **Auth**: Cookie-based sessions with Argon2 password hashing; `AuthenticatedUser` request guard protects all non-auth routes
- **LED task**: A single long-lived Tokio task (`led.rs`) receives `LedCommand` messages via a `watch` channel and drives all `LedController` instances. HTTP handlers interact with it via `LedRuntime` in Rocket managed state
- **Databases**:
  - `users.db` — read-only at runtime, written only by the `create-user` binary (`src/bin/create_user.rs`)
  - `app.db` — writable; holds `pin_mappings`, `presets`, `schedules`, `active_state`
- **Public types** in `src/lib.rs`: `RgbColour`, `LedPatternKind`, `LedPattern`, `LedPreset`, `PinMapping`, `AuthenticatedUser`, `Credentials`

### Frontend (`frontend/`)

- **Framework**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Data fetching**: TanStack Query v5
- **API client**: `frontend/src/lib/api/` — one file per resource (`auth.ts`, `mappings.ts`, `presets.ts`)
- **Shared types**: `frontend/src/lib/types.ts` — mirrors the Rust structs (`RgbColour`, `LedPatternKind`, `LedPattern`, `LedPreset`, `PinMapping`, `ActiveState`)
- **Colour picker**: `react-colorful`

## Coding Conventions

### Rust

- Use `edition = "2024"` features where appropriate
- All HTTP handlers take `_user: AuthenticatedUser` as the first guard to enforce authentication
- Return `Result<Json<T>, (Status, Json<ApiError>)>` from handlers; use the local `err()` helper for error mapping
- SQL queries use `sqlx::query` / `sqlx::query_as` inline (no macro-generated queries)
- `LedPatternKind` is stored in SQLite as plain TEXT (snake_case); serialise/deserialise via `serde_json` with the trim-quotes pattern used in `presets.rs`
- Route modules expose a `routes() -> Vec<Route>` function and are mounted in `main.rs`
- GPIO pin numbers are `u8`; PWM frequency is 200 Hz; per-channel gain constants live in `LedController::set_colour`

### TypeScript / React

- Strict TypeScript; no `any`
- All shared domain types live in `frontend/src/lib/types.ts` — do not duplicate them in component files
- API functions live in `frontend/src/lib/api/`; export them from `frontend/src/lib/api/index.ts`
- Use TanStack Query `useQuery` / `useMutation` for all server state; do not use `useState` + `useEffect` for fetching
- Format with Prettier; lint with ESLint (`eslint-plugin-simple-import-sort` enforces import order)
- Pages live in `frontend/src/pages/`; reusable UI components in `frontend/src/lib/components/`

## LED Patterns

Supported `LedPatternKind` values: `off`, `solid`, `pulse`, `blink`, `gradient`, `rainbow`. When adding a new pattern kind, update both the Rust enum in `src/lib.rs` and the TypeScript union in `frontend/src/lib/types.ts`.

## Build & Deploy

- Cross-compile target: `aarch64-unknown-linux-gnu` (Raspberry Pi)
- Run `npm run build` in `frontend/` and then `dist build` in the root to produce a release binary with the frontend embedded
- `dist-workspace.toml` configures `cargo-dist`
- The release binary expects static files in a `static/` directory adjacent to the executable

## Security Notes

- Never log passwords or cookie values
- The `create-user` binary (`src/bin/create_user.rs`) is the only path for creating user accounts; it hashes passwords with Argon2 before storing them
- `users.db` is opened read-only by the server (`?mode=ro` in `Rocket.toml`)
- Private cookies (Rocket's `CookieJar::get_private`) are used for sessions; ensure `secret_key` is set in production
