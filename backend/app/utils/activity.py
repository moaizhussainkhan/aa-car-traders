from sqlalchemy.orm import Session

from app.models import ActivityLog, User


def log_activity(db: Session, action: str, detail: str, actor: User | str | None = None) -> None:
    """Adds an Activity Feed row. The caller is responsible for db.commit()."""
    name = actor.name if isinstance(actor, User) else actor
    db.add(ActivityLog(action=action, detail=detail[:300], actor=(name or None)))
