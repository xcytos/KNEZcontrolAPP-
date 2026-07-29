use sea_orm::*;
use crate::entities::sqlite::checkpoints;
use crate::entities::postgres::document_checkpoint_links;

// SQLite checkpoints
pub mod sqlite {
    use super::*;

    pub async fn list_by_session(db: &DatabaseConnection, session_id: &str, limit: u64) -> Result<Vec<checkpoints::Model>, DbErr> {
        checkpoints::Entity::find()
            .filter(checkpoints::Column::SessionId.eq(session_id))
            .order_by(checkpoints::Column::CreatedAt, Order::Desc)
            .limit(limit)
            .all(db)
            .await
    }

    pub async fn list_all(db: &DatabaseConnection, limit: u64) -> Result<Vec<checkpoints::Model>, DbErr> {
        checkpoints::Entity::find()
            .order_by(checkpoints::Column::CreatedAt, Order::Desc)
            .limit(limit)
            .all(db)
            .await
    }
}

// PostgreSQL document_checkpoint_links
pub mod postgres {
    use super::*;

    pub async fn list_by_document(db: &DatabaseConnection, document_id: &sea_orm::prelude::Uuid) -> Result<Vec<document_checkpoint_links::Model>, DbErr> {
        document_checkpoint_links::Entity::find()
            .filter(document_checkpoint_links::Column::DocumentId.eq(*document_id))
            .all(db)
            .await
    }
}
