from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, ConsultantWarning, Notification, User

WINDOW_MINUTES = 30

# (category, action, threshold, severity, reason)
RULES: tuple[tuple[str, str, int, str, str], ...] = (
    ("bulk_delete", "scholarship.delete", 5, "critical", "Unusually high number of scholarship deletions"),
    ("rapid_edit", "scholarship.update", 40, "warning", "Unusually high number of scholarship edits"),
    ("bulk_import", "scholarship.import", 10, "warning", "Unusually high number of scholarship imports"),
)


def create_warning(
    db: Session,
    *,
    consultant: User,
    issued_by: User | None,
    severity: str,
    category: str,
    reason: str,
    detail: str | None = None,
    notify: bool = True,
) -> ConsultantWarning:
    warning = ConsultantWarning(
        consultant_id=consultant.id,
        issued_by_id=issued_by.id if issued_by else None,
        severity=severity,
        category=category,
        reason=reason,
        detail=detail,
    )
    db.add(warning)
    if notify:
        db.add(
            Notification(
                user_id=consultant.id,
                title=f"Platform warning: {reason}",
                body=detail or reason,
                kind="warning",
                link="/consultant/warnings",
            )
        )
    db.flush()
    return warning


def _recent_warning_exists(db: Session, consultant_id: int, category: str) -> bool:
    since = datetime.now(UTC) - timedelta(minutes=WINDOW_MINUTES)
    return (
        db.scalar(
            select(func.count(ConsultantWarning.id)).where(
                ConsultantWarning.consultant_id == consultant_id,
                ConsultantWarning.category == category,
                ConsultantWarning.created_at >= since,
            )
        )
        or 0
    ) > 0


def evaluate_consultant(db: Session, consultant: User) -> list[ConsultantWarning]:
    """Detect suspicious consultant activity in the recent window and raise warnings.

    Deduplicated per category within the window so a consultant is not spammed.
    """
    since = datetime.now(UTC) - timedelta(minutes=WINDOW_MINUTES)
    created: list[ConsultantWarning] = []
    for category, action, threshold, severity, reason in RULES:
        count = (
            db.scalar(
                select(func.count(AuditLog.id)).where(
                    AuditLog.actor_id == consultant.id,
                    AuditLog.action == action,
                    AuditLog.created_at >= since,
                )
            )
            or 0
        )
        if count < threshold or _recent_warning_exists(db, consultant.id, category):
            continue
        created.append(
            create_warning(
                db,
                consultant=consultant,
                issued_by=None,
                severity=severity,
                category=category,
                reason=reason,
                detail=f"Detected {count} '{action}' events in the last {WINDOW_MINUTES} minutes.",
            )
        )
    return created
