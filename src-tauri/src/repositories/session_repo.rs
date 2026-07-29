use sea_orm::*;
use crate::entities::sqlite::sessions;

pub async fn list_all(db: &DatabaseConnection, limit: u64) -> Result<Vec<sessions::Model>, DbErr> {
    sessions::Entity::find()
        .order_by(sessions::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn find_by_session_id(db: &DatabaseConnection, session_id: &str) -> Result<Option<sessions::Model>, DbErr> {
    sessions::Entity::find()
        .filter(sessions::Column::SessionId.eq(session_id))
        .one(db)
        .await
}

pub async fn find_by_display_id(db: &DatabaseConnection, display_id: &str) -> Result<Option<sessions::Model>, DbErr> {
    sessions::Entity::find()
        .filter(sessions::Column::DisplayId.eq(display_id))
        .one(db)
        .await
}

pub async fn find_by_project(db: &DatabaseConnection, project_id: &str) -> Result<Vec<sessions::Model>, DbErr> {
    sessions::Entity::find()
        .filter(sessions::Column::ProjectId.eq(project_id))
        .order_by(sessions::Column::CreatedAt, Order::Desc)
        .all(db)
        .await
}

pub async fn find_by_status(db: &DatabaseConnection, status: &str) -> Result<Vec<sessions::Model>, DbErr> {
    sessions::Entity::find()
        .filter(sessions::Column::Status.eq(status))
        .order_by(sessions::Column::UpdatedAt, Order::Desc)
        .all(db)
        .await
}

pub async fn update_status(db: &DatabaseConnection, session_id: &str, new_status: &str) -> Result<bool, DbErr> {
    use sea_orm::Set;

    if let Some(session) = find_by_session_id(db, session_id).await? {
        let mut active: sessions::ActiveModel = session.into();
        active.status = Set(new_status.to_owned());
        active.updated_at = Set(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string());
        let _ = active.update(db).await?;
        Ok(true)
    } else {
        Ok(false)
    }
}
