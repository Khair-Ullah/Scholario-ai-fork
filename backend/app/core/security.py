import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

ALGORITHM = "HS256"
PASSWORD_CONTEXT = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def secret_key() -> str:
    key = os.getenv("SECRET_KEY", "")
    if len(key) < 32:
        if os.getenv("APP_ENV", "development") == "production":
            raise RuntimeError("SECRET_KEY must be at least 32 characters in production")
        return "local-development-secret-key-change-before-deploy-0001"
    return key


def hash_password(password: str) -> str:
    return PASSWORD_CONTEXT.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return PASSWORD_CONTEXT.verify(password, password_hash)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_token(user_id: int, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(claims, secret_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None
