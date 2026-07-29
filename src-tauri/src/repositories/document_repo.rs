use sea_orm::*;
use sea_orm::prelude::*;
use crate::entities::postgres::documents;

pub async fn list_all(db: &DatabaseConnection, limit: u64) -> Result<Vec<documents::Model>, DbErr> {
    documents::Entity::find()
        .order_by(documents::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn find_by_document_id(db: &DatabaseConnection, document_id: &Uuid) -> Result<Option<documents::Model>, DbErr> {
    documents::Entity::find()
        .filter(documents::Column::DocumentId.eq(*document_id))
        .one(db)
        .await
}

pub async fn search(db: &DatabaseConnection, query: &str, limit: u64) -> Result<Vec<documents::Model>, DbErr> {
    let pattern = format!("%{}%", query);
    documents::Entity::find()
        .filter(
            Condition::any()
                .add(documents::Column::Title.contains(&pattern))
                .add(documents::Column::Content.contains(&pattern))
                .add(documents::Column::ProjectName.contains(&pattern))
        )
        .order_by(documents::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn find_by_session(db: &DatabaseConnection, session_id: &str, limit: u64) -> Result<Vec<documents::Model>, DbErr> {
    documents::Entity::find()
        .filter(documents::Column::SessionId.eq(session_id))
        .order_by(documents::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn find_by_project(db: &DatabaseConnection, project_id: &str, limit: u64) -> Result<Vec<documents::Model>, DbErr> {
    documents::Entity::find()
        .filter(documents::Column::ProjectId.eq(project_id))
        .order_by(documents::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn create(db: &DatabaseConnection, model: documents::ActiveModel) -> Result<documents::Model, DbErr> {
    model.insert(db).await
}
