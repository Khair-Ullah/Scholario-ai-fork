import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

ALGORITHM = "HS256"
PASSWORD_CONTEXT = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
TOTP_ISSUER = os.getenv("TOTP_ISSUER", "Scholario")
TOTP_VALID_WINDOW = 1
RECOVERY_CODE_COUNT = 8


_DEV_FALLBACK_KEY: str | None = None


def secret_key() -> str:
    key = os.getenv("SECRET_KEY", "")
    if len(key) >= 32:
        return key
    if os.getenv("APP_ENV", "development") == "production":
        raise RuntimeError("SECRET_KEY must be at least 32 characters in production")
    global _DEV_FALLBACK_KEY
    if _DEV_FALLBACK_KEY is None:
        _DEV_FALLBACK_KEY = secrets.token_urlsafe(48)
    return _DEV_FALLBACK_KEY


def hash_password(password: str) -> str:
    return PASSWORD_CONTEXT.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return PASSWORD_CONTEXT.verify(password, password_hash)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_token(user_id: int, token_type: str, expires_delta: timedelta, token_version: int = 0) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": secrets.token_urlsafe(16),
        "ver": int(token_version),
    }
    return jwt.encode(claims, secret_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    cleaned = code.strip().replace(" ", "")
    if not cleaned.isdigit():
        return False
    return pyotp.TOTP(secret).verify(cleaned, valid_window=TOTP_VALID_WINDOW)


def new_recovery_codes() -> list[str]:
    return [f"{secrets.token_hex(3)}-{secrets.token_hex(3)}" for _ in range(RECOVERY_CODE_COUNT)]


def hash_recovery_code(code: str) -> str:
    return hash_token(code.strip().lower())


def consume_recovery_code(hashed_codes: list[str], code: str) -> tuple[bool, list[str]]:
    """Return (matched, remaining_hashes). Removes the used code when matched."""
    target = hash_recovery_code(code)
    remaining = [h for h in (hashed_codes or []) if h != target]
    matched = len(remaining) != len(hashed_codes or [])
    return matched, remaining
