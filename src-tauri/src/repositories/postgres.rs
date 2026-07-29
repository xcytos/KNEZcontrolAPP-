use sea_orm::{Database, DatabaseConnection, DbErr};

pub async fn connect(connection_string: &str) -> Result<DatabaseConnection, DbErr> {
    Database::connect(connection_string).await
}
