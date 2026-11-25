import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.csrf import CSRF_COOKIE, new_csrf_token, set_csrf_cookie
from app.core.deps import get_current_user, get_db
from app.core.permissions import ROLE_CONSULTANT, ROLE_STUDENT, ROLE_SUPER_ADMIN
from app.core.ratelimit import limiter
from app.core.security import (
    consume_recovery_code,
    create_token,
    decode_token,
    generate_totp_secret,
    hash_password,
    hash_recovery_code,
    hash_token,
    new_recovery_codes,
    secret_key,
    totp_provisioning_uri,
    verify_password,
    verify_totp,
)
from app.models import AuthToken, RefreshToken, User
from app.schemas.user import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MfaCodeRequest,
    MfaSetupResponse,
    MfaStatusResponse,
    RegistrationPending,
    ResendOTPRequest,
    ResetPasswordRequest,
    UserCreate,
    UserPublic,
    VerifyEmailRequest,
)
from app.services import auth_guard
from app.services.audit import log_audit, request_ip
from app.services.email import send_password_reset, send_verification_otp
from app.services.net import client_ip
from app.services.settings import get_settings
from app.services.token_blocklist import purge_expired, revoke_access_claims

router = APIRouter(prefix="/api/auth", tags=["auth"])
ACCESS_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
REFRESH_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "14"))

_DUMMY_PASSWORD_HASH = (
    "$bcrypt-sha256$v=2,t=2b,r=12$xOTkqZpffusT0PKwgAaZ9e$YLm0wztOGPgimLTllpuzvBu1OFJsYAW"
)

PASSWORD_RESET_MINUTES = 30
EMAIL_OTP_PURPOSE = "email_otp"


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


EMAIL_OTP_TTL_MINUTES = _env_int("EMAIL_OTP_TTL_MINUTES", 10)
EMAIL_OTP_MAX_ATTEMPTS = _env_int("EMAIL_OTP_MAX_ATTEMPTS", 5)
EMAIL_OTP_RESEND_COOLDOWN = _env_int("EMAIL_OTP_RESEND_COOLDOWN", 60)


def _email_verification_required() -> bool:
    return os.getenv("REQUIRE_EMAIL_VERIFICATION", "true").strip().lower() not in {"0", "false", "no", "off"}


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _frontend_base() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


def _issue_auth_token(db: Session, user: User, purpose: str, minutes: int) -> str:
    db.execute(
        update(AuthToken)
        .where(AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used.is_(False))
        .values(used=True)
    )
    raw = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(raw),
            expires_at=datetime.now(UTC) + timedelta(minutes=minutes),
        )
    )
    return raw


def _otp_digest(otp: str) -> str:
    return hmac.new(secret_key().encode("utf-8"), otp.encode("utf-8"), hashlib.sha256).hexdigest()


def _issue_email_otp(db: Session, user: User) -> str:
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == EMAIL_OTP_PURPOSE,
            AuthToken.used.is_(False),
        )
        .values(used=True)
    )
    otp = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=EMAIL_OTP_PURPOSE,
            token_hash=_otp_digest(otp),
            expires_at=datetime.now(UTC) + timedelta(minutes=EMAIL_OTP_TTL_MINUTES),
            attempts=0,
        )
    )
    db.flush()
    return otp


def _verify_email_otp(db: Session, user: User, submitted_otp: str) -> None:
    token = db.scalar(
        select(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == EMAIL_OTP_PURPOSE,
            AuthToken.used.is_(False),
        )
        .order_by(AuthToken.created_at.desc())
        .with_for_update()
    )
    if token is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification code",
            headers={"X-Error-Code": "OTP_INVALID"},
        )
    if _as_utc(token.expires_at) <= datetime.now(UTC):
        token.used = True
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Verification code expired",
            headers={"X-Error-Code": "OTP_EXPIRED"},
        )
    if token.attempts >= EMAIL_OTP_MAX_ATTEMPTS:
        token.used = True
        db.commit()
        raise HTTPException(
            status_code=429,
            detail="Maximum verification attempts reached",
            headers={"X-Error-Code": "OTP_LIMIT"},
        )
    if not hmac.compare_digest(token.token_hash, _otp_digest(submitted_otp)):
        token.attempts += 1
        db.commit()
        code = "OTP_LIMIT" if token.attempts >= EMAIL_OTP_MAX_ATTEMPTS else "OTP_INVALID"
        raise HTTPException(
            status_code=429 if token.attempts >= EMAIL_OTP_MAX_ATTEMPTS else 400,
            detail="Invalid or expired verification code",
            headers={"X-Error-Code": code},
        )
    token.used = True


def _set_session(response: Response, user: User, db: Session, request: Request) -> None:
    refresh_expiry = datetime.now(UTC) + timedelta(days=REFRESH_DAYS)
    access = create_token(
        user.id, "access", timedelta(minutes=ACCESS_MINUTES), token_version=user.token_version
    )
    refresh = create_token(
        user.id, "refresh", timedelta(days=REFRESH_DAYS), token_version=user.token_version
    )
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=refresh_expiry,
            user_agent=request.headers.get("user-agent", "")[:500] or None,
            ip=client_ip(request),
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


def _check_lockout(db: Session, email: str, ip: str | None = None) -> None:
    if auth_guard.is_locked(db, email) or auth_guard.is_ip_locked(db, ip):
        raise HTTPException(
            status_code=429,
            detail="Too many failed sign-in attempts. Try again later.",
            headers={"X-Error-Code": "AUTH_LOCKED", "Retry-After": str(auth_guard.LOCKOUT_WINDOW_MINUTES * 60)},
        )


def _verify_second_factor(user: User, payload: LoginRequest, db: Session, ip: str | None) -> None:
    if not user.totp_enabled:
        return
    supplied = (payload.totp_code or "").strip()
    if not supplied:
        raise HTTPException(
            status_code=401,
            detail="Two-factor authentication code required",
            headers={"X-Error-Code": "MFA_REQUIRED"},
        )
    if verify_totp(user.totp_secret or "", supplied):
        return
    matched, remaining = consume_recovery_code(user.totp_recovery_codes or [], supplied)
    if matched:
        user.totp_recovery_codes = remaining
        return
    auth_guard.record_attempt(db, email=user.email, ip=ip, succeeded=False)
    db.commit()
    raise HTTPException(
        status_code=401,
        detail="Invalid two-factor authentication code",
        headers={"X-Error-Code": "MFA_INVALID"},
    )


def _revoke_user_sessions(db: Session, user: User) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    user.token_version += 1


def _authenticate(
    db: Session,
    request: Request,
    response: Response,
    payload: LoginRequest,
    required_roles: set[str] | None = None,
    forbidden_detail: str | None = None,
) -> AuthResponse:
    email = str(payload.email).lower()
    ip = client_ip(request)
    _check_lockout(db, email, ip)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(payload.password, _DUMMY_PASSWORD_HASH)
        auth_guard.record_attempt(db, email=email, ip=ip, succeeded=False)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Email or password is incorrect",
            headers={"X-Error-Code": "AUTH_INVALID_CREDENTIALS"},
        )
    if not verify_password(payload.password, user.password_hash):
        auth_guard.record_attempt(db, email=email, ip=ip, succeeded=False)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Email or password is incorrect",
            headers={"X-Error-Code": "AUTH_INVALID_CREDENTIALS"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive", headers={"X-Error-Code": "AUTH_INACTIVE"})
    if _email_verification_required() and not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in.",
            headers={"X-Error-Code": "EMAIL_NOT_VERIFIED"},
        )
    if required_roles is not None and user.role not in required_roles:
        raise HTTPException(
            status_code=403,
            detail=forbidden_detail or "You do not have access to this panel",
            headers={"X-Error-Code": "AUTH_FORBIDDEN"},
        )
    _verify_second_factor(user, payload, db, ip)
    auth_guard.clear_attempts(db, email)
    auth_guard.clear_ip_attempts(db, ip)
    user.last_login_at = datetime.now(UTC)
    _set_session(response, user, db, request)
    db.commit()
    db.refresh(user)
    return AuthResponse(user=UserPublic.model_validate(user), message="Signed in")


def _record_failed_login(db: Session, request: Request, payload: LoginRequest, action: str) -> None:
    log_audit(
        db,
        actor=None,
        action=action,
        entity="auth",
        actor_email=str(payload.email).lower(),
        ip=request_ip(request),
        commit=True,
    )


@router.post("/register", response_model=RegistrationPending, status_code=201)
@limiter.limit("5/minute")
def register(
    payload: UserCreate, request: Request, response: Response, db: Session = Depends(get_db)
) -> RegistrationPending:
    email = str(payload.email).lower()
    settings = get_settings(db)
    if not settings.get("flags", {}).get("registration_enabled", True):
        raise HTTPException(
            status_code=403,
            detail="Registration is currently disabled. Please contact support.",
            headers={"X-Error-Code": "REGISTRATION_DISABLED"},
        )
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
            headers={"X-Error-Code": "EMAIL_IN_USE"},
        )
    referrer = None
    if payload.referral_code:
        referrer = db.scalar(select(User).where(User.referral_code == payload.referral_code))
    verification_required = _email_verification_required()
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        referral_code=secrets.token_urlsafe(9),
        referred_by_id=referrer.id if referrer else None,
        is_verified=not verification_required,
    )
    db.add(user)
    db.flush()
    if referrer is not None:
        referred_count = db.scalar(select(func.count(User.id)).where(User.referred_by_id == referrer.id)) or 0
        if referred_count >= 3 and referrer.plan != "pro":
            referrer.plan = "pro"
    if not verification_required:
        _set_session(response, user, db, request)
        db.commit()
        return RegistrationPending(
            message="Account created.", email=email, verification_required=False, email_sent=False
        )
    otp = _issue_email_otp(db, user)
    db.commit()
    email_sent = send_verification_otp(user.email, otp)
    message = (
        "Account created. Please verify your email."
        if email_sent
        else "Account created. Verification email could not be sent. Please resend the code."
    )
    return RegistrationPending(
        message=message, email=email, verification_required=True, email_sent=email_sent
    )


@router.post("/verify-email")
@limiter.limit("5/minute")
def verify_email(
    payload: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification code",
            headers={"X-Error-Code": "OTP_INVALID"},
        )
    if user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification request",
            headers={"X-Error-Code": "OTP_INVALID"},
        )
    _verify_email_otp(db, user, payload.otp)
    user.is_verified = True
    log_audit(
        db,
        actor=user,
        action="auth.email_verified",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
    )
    db.commit()
    return {"message": "Email successfully verified. You can now sign in."}


@router.post("/resend-otp")
@limiter.limit("3/minute")
def resend_otp(
    payload: ResendOTPRequest, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    email = str(payload.email).lower()
    generic = {"message": "If verification is pending, a new code will be sent."}
    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.is_verified:
        return generic
    latest = db.scalar(
        select(AuthToken)
        .where(AuthToken.user_id == user.id, AuthToken.purpose == EMAIL_OTP_PURPOSE)
        .order_by(AuthToken.created_at.desc())
    )
    if latest and (datetime.now(UTC) - _as_utc(latest.created_at)).total_seconds() < EMAIL_OTP_RESEND_COOLDOWN:
        return generic
    otp = _issue_email_otp(db, user)
    db.commit()
    send_verification_otp(user.email, otp)
    log_audit(
        db,
        actor=None,
        action="auth.verification_resent",
        entity="user",
        entity_id=user.id,
        actor_email=email,
        ip=request_ip(request),
    )
    db.commit()
    return generic


@router.post("/forgot-password", status_code=202)
@limiter.limit("5/minute")
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is not None and user.is_active:
        token = _issue_auth_token(db, user, "password_reset", PASSWORD_RESET_MINUTES)
        link = f"{_frontend_base()}/reset-password?token={token}"
        send_password_reset(user.email, link)
        log_audit(
            db,
            actor=None,
            action="auth.password_reset_requested",
            entity="auth",
            actor_email=email,
            ip=request_ip(request),
        )
        db.commit()
    # Always return the same message so callers cannot discover registered emails.
    return {"message": "If an account exists for that email, we've sent reset instructions."}


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(
    payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    stored = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_token(payload.token),
            AuthToken.purpose == "password_reset",
        )
    )
    if (
        stored is None
        or stored.used
        or stored.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC)
    ):
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Please request a new one.",
            headers={"X-Error-Code": "RESET_INVALID"},
        )
    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Please request a new one.",
            headers={"X-Error-Code": "RESET_INVALID"},
        )
    user.password_hash = hash_password(payload.password)
    stored.used = True
    _revoke_user_sessions(db, user)
    log_audit(
        db,
        actor=user,
        action="auth.password_reset",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
    )
    db.commit()
    return {"message": "Password updated. Please sign in with your new password."}


def _verify_google_credential(credential: str) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured",
            headers={"X-Error-Code": "GOOGLE_AUTH_DISABLED"},
        )
    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Google sign-in could not be verified",
            headers={"X-Error-Code": "GOOGLE_INVALID"},
        ) from None
    if not info.get("email_verified"):
        raise HTTPException(
            status_code=401,
            detail="Your Google email is not verified",
            headers={"X-Error-Code": "GOOGLE_EMAIL_UNVERIFIED"},
        )
    email = str(info.get("email", "")).lower()
    subject = str(info.get("sub", ""))
    if not email or not subject:
        raise HTTPException(
            status_code=401,
            detail="Google sign-in could not be verified",
            headers={"X-Error-Code": "GOOGLE_INVALID"},
        )
    return dict(info)


@router.post("/google", response_model=AuthResponse | RegistrationPending)
@limiter.limit("10/minute")
def google_auth(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse | RegistrationPending:
    info = _verify_google_credential(payload.credential)
    email = str(info.get("email", "")).lower()
    subject = str(info.get("sub", ""))

    verification_required = _email_verification_required()
    user = db.scalar(select(User).where(User.google_sub == subject))
    if user is None:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "An account already exists. Please sign in with your existing "
                    "credentials before linking Google."
                ),
                headers={"X-Error-Code": "GOOGLE_LINK_REQUIRED"},
            )
        display_name = str(info.get("name") or email.split("@")[0])[:200]
        user = User(
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            full_name=display_name,
            referral_code=secrets.token_urlsafe(9),
            is_verified=not verification_required,
            google_sub=subject,
        )
        db.add(user)
        db.flush()
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=403, detail="Account is inactive", headers={"X-Error-Code": "AUTH_INACTIVE"}
            )
        if user.role != ROLE_STUDENT:
            raise HTTPException(
                status_code=403,
                detail="This is the student sign-in. Please use your dedicated portal.",
                headers={"X-Error-Code": "AUTH_FORBIDDEN"},
            )

    if verification_required and not user.is_verified:
        otp = _issue_email_otp(db, user)
        db.commit()
        email_sent = send_verification_otp(user.email, otp)
        message = (
            "Account created. Please verify your email."
            if email_sent
            else "Account created. Verification email could not be sent. Please resend the code."
        )
        return RegistrationPending(
            message=message, email=user.email, verification_required=True, email_sent=email_sent
        )

    auth_guard.clear_attempts(db, email)
    user.last_login_at = datetime.now(UTC)
    _set_session(response, user, db, request)
    db.commit()
    db.refresh(user)
    return AuthResponse(user=UserPublic.model_validate(user), message="Signed in with Google")


@router.post("/google/link")
@limiter.limit("5/minute")
def link_google_account(
    payload: GoogleAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    info = _verify_google_credential(payload.credential)
    google_email = str(info.get("email", "")).lower()
    subject = str(info.get("sub", ""))
    if google_email != user.email.lower():
        raise HTTPException(
            status_code=400,
            detail="Google email must match your Scholario email",
            headers={"X-Error-Code": "GOOGLE_EMAIL_MISMATCH"},
        )
    linked = db.scalar(select(User).where(User.google_sub == subject))
    if linked is not None and linked.id != user.id:
        raise HTTPException(
            status_code=409,
            detail="This Google account is already linked",
            headers={"X-Error-Code": "GOOGLE_ALREADY_LINKED"},
        )
    if user.google_sub and user.google_sub != subject:
        raise HTTPException(
            status_code=409,
            detail="Another Google account is already linked",
            headers={"X-Error-Code": "GOOGLE_ALREADY_LINKED"},
        )
    user.google_sub = subject
    db.commit()
    return {"message": "Google account linked"}


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        return _authenticate(
            db,
            request,
            response,
            payload,
            required_roles={ROLE_STUDENT},
            forbidden_detail="This is the student sign-in. Staff and administrators must use their dedicated portal.",
        )
    except HTTPException as exc:
        if (exc.headers or {}).get("X-Error-Code") == "AUTH_FORBIDDEN":
            _record_failed_login(db, request, payload, "auth.login_forbidden")
        raise


@router.post("/admin/login", response_model=AuthResponse)
@limiter.limit("3/minute")
def admin_login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> AuthResponse:
    try:
        result = _authenticate(db, request, response, payload, required_roles={ROLE_SUPER_ADMIN})
    except HTTPException as exc:
        if (exc.headers or {}).get("X-Error-Code") not in {"MFA_REQUIRED", "MFA_INVALID"}:
            _record_failed_login(db, request, payload, "auth.admin_login_failed")
        raise
    user = db.get(User, result.user.id)
    log_audit(
        db,
        actor=user,
        action="auth.admin_login",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
        commit=True,
    )
    return result


@router.post("/consultant/login", response_model=AuthResponse)
@limiter.limit("3/minute")
def consultant_login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> AuthResponse:
    try:
        result = _authenticate(db, request, response, payload, required_roles={ROLE_CONSULTANT})
    except HTTPException as exc:
        if (exc.headers or {}).get("X-Error-Code") not in {"MFA_REQUIRED", "MFA_INVALID"}:
            _record_failed_login(db, request, payload, "auth.consultant_login_failed")
        raise
    user = db.get(User, result.user.id)
    log_audit(
        db,
        actor=user,
        action="auth.consultant_login",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
        commit=True,
    )
    return result


@router.get("/csrf")
def csrf_token(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(CSRF_COOKIE) or new_csrf_token()
    set_csrf_cookie(response, token)
    return {"token": token}


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
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
    if not stored:
        raise HTTPException(
            status_code=401, detail="Refresh token is invalid or expired", headers={"X-Error-Code": "REFRESH_INVALID"}
        )
    if stored.revoked:
        user = db.get(User, stored.user_id)
        if user is not None:
            _revoke_user_sessions(db, user)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Refresh token reuse detected. Please sign in again.",
            headers={"X-Error-Code": "REFRESH_REUSED"},
        )
    if stored.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        raise HTTPException(
            status_code=401, detail="Refresh token is invalid or expired", headers={"X-Error-Code": "REFRESH_INVALID"}
        )
    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable", headers={"X-Error-Code": "AUTH_INVALID"})
    if _email_verification_required() and not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email verification required",
            headers={"X-Error-Code": "EMAIL_NOT_VERIFIED"},
        )
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
    revoke_access_claims(db, decode_token(request.cookies.get("access_token", "")))
    purge_expired(db)
    db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")
    return {"message": "Signed out"}


@router.get("/mfa/status", response_model=MfaStatusResponse)
def mfa_status(user: User = Depends(get_current_user)) -> MfaStatusResponse:
    return MfaStatusResponse(
        enabled=user.totp_enabled,
        has_pending_secret=bool(user.totp_secret) and not user.totp_enabled,
        recovery_codes_remaining=len(user.totp_recovery_codes or []),
    )


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MfaSetupResponse:
    if user.totp_enabled:
        raise HTTPException(
            status_code=409,
            detail="Two-factor authentication is already enabled",
            headers={"X-Error-Code": "MFA_ALREADY_ENABLED"},
        )
    secret = generate_totp_secret()
    user.totp_secret = secret
    db.commit()
    return MfaSetupResponse(secret=secret, otpauth_uri=totp_provisioning_uri(secret, user.email))


@router.post("/mfa/enable", response_model=AuthResponse)
def mfa_enable(
    payload: MfaCodeRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> AuthResponse:
    if user.totp_enabled:
        raise HTTPException(
            status_code=409,
            detail="Two-factor authentication is already enabled",
            headers={"X-Error-Code": "MFA_ALREADY_ENABLED"},
        )
    if not user.totp_secret or not verify_totp(user.totp_secret, payload.code):
        raise HTTPException(
            status_code=400, detail="Invalid verification code", headers={"X-Error-Code": "MFA_INVALID"}
        )
    recovery = new_recovery_codes()
    user.totp_enabled = True
    user.totp_recovery_codes = [hash_recovery_code(code) for code in recovery]
    log_audit(
        db,
        actor=user,
        action="auth.mfa_enabled",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
    )
    db.commit()
    return AuthResponse(
        user=UserPublic.model_validate(user),
        message="Two-factor authentication enabled. Store your recovery codes safely.",
        recovery_codes=recovery,
    )


@router.post("/mfa/disable", response_model=AuthResponse)
def mfa_disable(
    payload: MfaCodeRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> AuthResponse:
    if not user.totp_enabled:
        raise HTTPException(
            status_code=409,
            detail="Two-factor authentication is not enabled",
            headers={"X-Error-Code": "MFA_NOT_ENABLED"},
        )
    valid = verify_totp(user.totp_secret or "", payload.code)
    if not valid:
        matched, remaining = consume_recovery_code(user.totp_recovery_codes or [], payload.code)
        if matched:
            user.totp_recovery_codes = remaining
            valid = True
    if not valid:
        raise HTTPException(
            status_code=400, detail="Invalid verification code", headers={"X-Error-Code": "MFA_INVALID"}
        )
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_recovery_codes = []
    log_audit(
        db,
        actor=user,
        action="auth.mfa_disabled",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
    )
    db.commit()
    return AuthResponse(user=UserPublic.model_validate(user), message="Two-factor authentication disabled")


@router.post("/mfa/recovery-codes", response_model=AuthResponse)
def mfa_regenerate_recovery(
    payload: MfaCodeRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> AuthResponse:
    if not user.totp_enabled or not verify_totp(user.totp_secret or "", payload.code):
        raise HTTPException(
            status_code=400, detail="Invalid verification code", headers={"X-Error-Code": "MFA_INVALID"}
        )
    recovery = new_recovery_codes()
    user.totp_recovery_codes = [hash_recovery_code(code) for code in recovery]
    log_audit(
        db,
        actor=user,
        action="auth.mfa_recovery_regenerated",
        entity="user",
        entity_id=user.id,
        ip=request_ip(request),
    )
    db.commit()
    return AuthResponse(
        user=UserPublic.model_validate(user),
        message="New recovery codes generated.",
        recovery_codes=recovery,
    )
