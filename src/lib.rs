use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use serde::Deserialize;
use std::path::PathBuf;

pub fn static_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/static"))
    } else {
        std::env::current_exe()
            .expect("failed to get current exe path")
            .parent()
            .expect("exe has no parent dir")
            .join("static")
    }
}

#[derive(Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

pub struct AuthenticatedUser {
    pub username: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthenticatedUser {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match req.cookies().get_private("session") {
            Some(cookie) => Outcome::Success(AuthenticatedUser {
                username: cookie.value().to_string(),
            }),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}
