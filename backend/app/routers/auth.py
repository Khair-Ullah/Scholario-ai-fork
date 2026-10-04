import os
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_token, decode_token, hash_password, hash_token, verify_password
from app.models import RefreshToken, User
from app.schemas.user import AuthResponse, LoginRequest, UserCreate, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])
ACCESS_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
REFRESH_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "14"))


def _set_session(response: Response, user: User, db: Session, request: Request) -> None:
    refresh_expiry = datetime.now(UTC) + timedelta(days=REFRESH_DAYS)
    access = create_token(user.id, "access", timedelta(minutes=ACCESS_MINUTES))
    refresh = create_token(user.id, "refresh", timedelta(days=REFRESH_DAYS))
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=refresh_expiry,
            user_agent=request.headers.get("user-agent", "")[:500] or None,
            ip=request.client.host if request.client else None,
        )
    )
    response.set_cookie(
        "access_token",
        access,
        max_age=ACCESS_MINUTES * 60,
        httponly=True,
        secure=os.getenv("APP_ENV") == "production",
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        max_age=REFRESH_DAYS * 86400,
        httponly=True,
        secure=os.getenv("APP_ENV") == "production",
        samesite="lax",
        path="/api/auth",
    )


def _authenticate(
    db: Session, request: Request, response: Response, payload: LoginRequest, admin_only: bool = False
) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Email or password is incorrect",
            headers={"X-Error-Code": "AUTH_INVALID_CREDENTIALS"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive", headers={"X-Error-Code": "AUTH_INACTIVE"})
    if admin_only and user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Admin account required", headers={"X-Error-Code": "AUTH_ADMIN_REQUIRED"}
        )
    user.last_login_at = datetime.now(UTC)
    _set_session(response, user, db, request)
    db.commit()
    db.refresh(user)
    return AuthResponse(user=UserPublic.model_validate(user), message="Signed in")


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: UserCreate, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    email = str(payload.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
            headers={"X-Error-Code": "EMAIL_IN_USE"},
        )
    referrer = None
    if payload.referral_code:
        referrer = db.scalar(select(User).where(User.referral_code == payload.referral_code))
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        referral_code=secrets.token_urlsafe(9),
        referred_by_id=referrer.id if referrer else None,
    )
    db.add(user)
    db.flush()
    _set_session(response, user, db, request)
    db.commit()
    db.refresh(user)
    return AuthResponse(
        user=UserPublic.model_validate(user), message="Account created. Email verification is not configured yet."
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    return _authenticate(db, request, response, payload)


@router.post("/admin/login", response_model=AuthResponse)
def admin_login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> AuthResponse:
    return _authenticate(db, request, response, payload, admin_only=True)


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    token = request.cookies.get("refresh_token", "")
    claims = decode_token(token)
    if not claims or claims.get("type") != "refresh":
        raise HTTPException(
            status_code=401, detail="Refresh token is invalid or expired", headers={"X-Error-Code": "REFRESH_INVALID"}
        )
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(token), RefreshToken.revoked.is_(False))
    )
    if not stored or stored.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        raise HTTPException(
            status_code=401, detail="Refresh token is invalid or expired", headers={"X-Error-Code": "REFRESH_INVALID"}
        )
    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable", headers={"X-Error-Code": "AUTH_INVALID"})
    stored.revoked = True
    _set_session(response, user, db, request)
    db.commit()
    return AuthResponse(user=UserPublic.model_validate(user), message="Session refreshed")


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    token = request.cookies.get("refresh_token", "")
    if token:
        stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
        if stored:
            stored.revoked = True
            db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")
    return {"message": "Signed out"}
