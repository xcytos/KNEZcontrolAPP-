use sea_orm::{Database, DatabaseConnection, DbErr};

pub async fn connect(path: &str) -> Result<DatabaseConnection, DbErr> {
    let url = format!("sqlite:{}?mode=rwc", path);
    Database::connect(&url).await
}
