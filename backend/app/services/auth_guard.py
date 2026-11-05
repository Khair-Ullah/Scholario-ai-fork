from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import AuthAttempt

LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_WINDOW_MINUTES = 15


def _window_start() -> datetime:
    return datetime.now(UTC) - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)


def record_attempt(db: Session, *, email: str, ip: str | None, succeeded: bool) -> None:
    db.add(AuthAttempt(email=email.strip().lower(), ip=ip, succeeded=succeeded))
    # Opportunistically prune stale rows so the table stays small.
    db.execute(delete(AuthAttempt).where(AuthAttempt.created_at < datetime.now(UTC) - timedelta(days=2)))
    db.flush()


def failed_attempt_count(db: Session, email: str) -> int:
    return (
        db.scalar(
            select(func.count(AuthAttempt.id)).where(
                AuthAttempt.email == email.strip().lower(),
                AuthAttempt.succeeded.is_(False),
                AuthAttempt.created_at >= _window_start(),
            )
        )
        or 0
    )


def failed_ip_attempt_count(db: Session, ip: str | None) -> int:
    if not ip:
        return 0
    return (
        db.scalar(
            select(func.count(AuthAttempt.id)).where(
                AuthAttempt.ip == ip,
                AuthAttempt.succeeded.is_(False),
                AuthAttempt.created_at >= _window_start(),
            )
        )
        or 0
    )


def is_locked(db: Session, email: str) -> bool:
    return failed_attempt_count(db, email) >= LOCKOUT_MAX_ATTEMPTS


def is_ip_locked(db: Session, ip: str | None) -> bool:
    return failed_ip_attempt_count(db, ip) >= LOCKOUT_MAX_ATTEMPTS


def remaining_attempts(db: Session, email: str) -> int:
    return max(0, LOCKOUT_MAX_ATTEMPTS - failed_attempt_count(db, email))


def remaining_ip_attempts(db: Session, ip: str | None) -> int:
    return max(0, LOCKOUT_MAX_ATTEMPTS - failed_ip_attempt_count(db, ip))


def clear_attempts(db: Session, email: str) -> None:
    db.execute(delete(AuthAttempt).where(AuthAttempt.email == email.strip().lower()))


def clear_ip_attempts(db: Session, ip: str | None) -> None:
    if ip:
        db.execute(delete(AuthAttempt).where(AuthAttempt.ip == ip))
