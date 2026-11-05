from datetime import UTC, datetime

from app.models import User


def is_pro(user: User) -> bool:
    if user.plan != "pro":
        return False
    if user.plan_expires_at is None:
        return True
    expires = user.plan_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    return expires > datetime.now(UTC)