from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import RevokedAccessToken

DEFAULT_ACCESS_TTL = timedelta(minutes=30)


def revoke_access_claims(db: Session, claims: dict | None) -> bool:
    if not claims or claims.get("type") != "access":
        return False
    jti = claims.get("jti")
    if not isinstance(jti, str) or not jti:
        return False
    if db.scalar(select(RevokedAccessToken.id).where(RevokedAccessToken.jti == jti)):
        return False
    user_id: int | None = None
    try:
        user_id = int(claims.get("sub"))
    except (TypeError, ValueError):
        user_id = None
    exp = claims.get("exp")
    if isinstance(exp, (int, float)):
        expires_at = datetime.fromtimestamp(exp, UTC)
    else:
        expires_at = datetime.now(UTC) + DEFAULT_ACCESS_TTL
    db.add(RevokedAccessToken(jti=jti, user_id=user_id, expires_at=expires_at))
    return True


def is_access_revoked(db: Session, jti: str) -> bool:
    return db.scalar(select(RevokedAccessToken.id).where(RevokedAccessToken.jti == jti)) is not None


def purge_expired(db: Session) -> None:
    now = datetime.now(UTC)
    db.execute(delete(RevokedAccessToken).where(RevokedAccessToken.expires_at <= now))
