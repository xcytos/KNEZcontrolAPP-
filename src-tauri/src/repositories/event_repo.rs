use sea_orm::*;
use crate::entities::sqlite::events;

pub async fn list_by_session(db: &DatabaseConnection, session_id: &str, limit: u64) -> Result<Vec<events::Model>, DbErr> {
    events::Entity::find()
        .filter(events::Column::SessionId.eq(session_id))
        .order_by(events::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn find_by_type(db: &DatabaseConnection, event_type: &str, limit: u64) -> Result<Vec<events::Model>, DbErr> {
    events::Entity::find()
        .filter(events::Column::EventType.eq(event_type))
        .order_by(events::Column::CreatedAt, Order::Desc)
        .limit(limit)
        .all(db)
        .await
}

pub async fn count_by_session(db: &DatabaseConnection, session_id: &str) -> Result<u64, DbErr> {
    events::Entity::find()
        .filter(events::Column::SessionId.eq(session_id))
        .count(db)
        .await
}
