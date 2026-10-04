from collections.abc import Generator

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models import User


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
    try:
        user_id = int(claims["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=401, detail="Invalid access token", headers={"X-Error-Code": "AUTH_INVALID"}
        ) from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable", headers={"X-Error-Code": "AUTH_INVALID"})
    return user
