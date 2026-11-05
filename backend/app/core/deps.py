from collections.abc import Generator

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models import User
from app.services.token_blocklist import is_access_revoked


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def get_current_user(
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> User:
    token = access_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    claims = decode_token(token or "")
    if not claims or claims.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer", "X-Error-Code": "AUTH_REQUIRED"},
        )
    jti = claims.get("jti")
    if isinstance(jti, str) and jti and is_access_revoked(db, jti):
        raise HTTPException(
            status_code=401,
            detail="Session has been signed out",
            headers={"WWW-Authenticate": "Bearer", "X-Error-Code": "AUTH_REVOKED"},
        )
    try:
        user_id = int(claims["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=401, detail="Invalid access token", headers={"X-Error-Code": "AUTH_INVALID"}
        ) from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable", headers={"X-Error-Code": "AUTH_INVALID"})
    try:
        token_version = int(claims.get("ver", 0) or 0)
    except (TypeError, ValueError):
        token_version = 0
    if token_version != user.token_version:
        raise HTTPException(
            status_code=401,
            detail="Session has been signed out",
            headers={"WWW-Authenticate": "Bearer", "X-Error-Code": "AUTH_REVOKED"},
        )
    return user
