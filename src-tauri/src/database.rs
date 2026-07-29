use std::path::PathBuf;
use sqlx::postgres::PgPool;
use rusqlite::{Connection, Result as SqliteResult};

// PostgreSQL Configuration
#[derive(Debug, Clone)]
pub struct PostgresConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
}

impl PostgresConfig {
    pub fn connection_string(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}/{}?sslmode=require",
            self.user, self.password, self.host, self.port, self.database
        )
    }
}

// SQLite Operations (for Data Explorer generic functions)
pub fn connect_sqlite(db_path: PathBuf) -> SqliteResult<Connection> {
    Connection::open(db_path)
}

// PostgreSQL Operations
pub async fn connect_postgres(config: PostgresConfig) -> Result<PgPool, sqlx::Error> {
    use sqlx::postgres::PgPoolOptions;
    use std::time::Duration;
    
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .connect(&config.connection_string())
        .await?;
    
    Ok(pool)
}
