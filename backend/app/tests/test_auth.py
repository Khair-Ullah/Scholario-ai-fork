from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.ratelimit import limiter
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import AuthToken, User
from app.tests.helpers import apply_csrf

STRONG_PASSWORD = "a-strong-test-password"


@pytest.fixture
def client():
    limiter.reset()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture(autouse=True)
def require_verification(monkeypatch):
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "true")


@pytest.fixture(autouse=True)
def otp_sender(monkeypatch):
    sent = []

    def fake_send(to: str, otp: str) -> bool:
        sent.append((to, otp))
        return True

    monkeypatch.setattr("app.routers.auth.send_verification_otp", fake_send)
    return sent


def _add_user(
    client: TestClient,
    email: str,
    verified: bool = True,
    role: str = "student",
    google_sub: str | None = None,
) -> User:
    generator = app.dependency_overrides[get_db]()
    session = next(generator)
    user = User(
        email=email,
        password_hash=hash_password(STRONG_PASSWORD),
        full_name="Test User",
        role=role,
        is_verified=verified,
        referral_code=f"{email.split('@')[0]}-ref",
        google_sub=google_sub,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    generator.close()
    return user


def _register(client: TestClient, email: str):
    return client.post(
        "/api/auth/register",
        json={"email": email, "password": STRONG_PASSWORD, "full_name": "Test Student"},
    )


def _login(client: TestClient, email: str):
    return client.post("/api/auth/login", json={"email": email, "password": STRONG_PASSWORD})


def _age_latest_otp(client: TestClient, email: str, seconds: int) -> None:
    generator = app.dependency_overrides[get_db]()
    session = next(generator)
    token = session.scalar(
        select(AuthToken)
        .join(User, AuthToken.user_id == User.id)
        .where(
            User.email == email,
            AuthToken.purpose == "email_otp",
            AuthToken.used.is_(False),
        )
        .order_by(AuthToken.created_at.desc())
    )
    token.created_at = datetime.now(UTC) - timedelta(seconds=seconds)
    session.commit()
    generator.close()


def _expire_latest_otp(client: TestClient, email: str) -> None:
    generator = app.dependency_overrides[get_db]()
    session = next(generator)
    token = session.scalar(
        select(AuthToken)
        .join(User, AuthToken.user_id == User.id)
        .where(
            User.email == email,
            AuthToken.purpose == "email_otp",
            AuthToken.used.is_(False),
        )
        .order_by(AuthToken.created_at.desc())
    )
    token.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    session.commit()
    generator.close()


def _different_code(code: str) -> str:
    return "111111" if code == "000000" else "000000"


def test_registration_requires_email_verification(client: TestClient, otp_sender) -> None:
    response = _register(client, "new@example.com")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["verification_required"] is True
    assert body["email_sent"] is True
    assert "user" not in body
    assert client.cookies.get("access_token") is None
    assert client.cookies.get("refresh_token") is None
    assert client.get("/api/auth/me").status_code == 401
    assert len(otp_sender) == 1


def test_correct_otp_verifies_email(client: TestClient, otp_sender) -> None:
    _register(client, "verify@example.com")
    otp = otp_sender[-1][1]
    response = client.post(
        "/api/auth/verify-email", json={"email": "verify@example.com", "otp": otp}
    )
    assert response.status_code == 200
    assert _login(client, "verify@example.com").status_code == 200
    assert client.get("/api/auth/me").json()["email"] == "verify@example.com"


def test_unverified_user_cannot_login(client: TestClient) -> None:
    _register(client, "unverified@example.com")
    response = _login(client, "unverified@example.com")
    assert response.status_code == 403
    assert response.json()["code"] == "EMAIL_NOT_VERIFIED"


def test_wrong_otp_is_rejected(client: TestClient, otp_sender) -> None:
    _register(client, "wrong@example.com")
    wrong = _different_code(otp_sender[-1][1])
    response = client.post(
        "/api/auth/verify-email", json={"email": "wrong@example.com", "otp": wrong}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "OTP_INVALID"
    assert _login(client, "wrong@example.com").status_code == 403


def test_expired_otp_is_rejected(client: TestClient, otp_sender) -> None:
    email = "expired@example.com"
    _register(client, email)
    _expire_latest_otp(client, email)
    response = client.post(
        "/api/auth/verify-email", json={"email": email, "otp": otp_sender[-1][1]}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "OTP_EXPIRED"


def test_used_otp_is_rejected(client: TestClient, otp_sender) -> None:
    email = "used@example.com"
    _register(client, email)
    payload = {"email": email, "otp": otp_sender[-1][1]}
    assert client.post("/api/auth/verify-email", json=payload).status_code == 200
    response = client.post("/api/auth/verify-email", json=payload)
    assert response.status_code == 400
    assert response.json()["code"] == "OTP_INVALID"


def test_old_otp_is_invalid_after_resend(client: TestClient, otp_sender, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.auth.EMAIL_OTP_RESEND_COOLDOWN", 0)
    email = "resend@example.com"
    _register(client, email)
    first_otp = otp_sender[-1][1]
    assert client.post("/api/auth/resend-otp", json={"email": email}).status_code == 200
    assert otp_sender[-1][1] != first_otp
    old = client.post("/api/auth/verify-email", json={"email": email, "otp": first_otp})
    assert old.status_code == 400
    assert old.json()["code"] == "OTP_INVALID"
    new = client.post(
        "/api/auth/verify-email", json={"email": email, "otp": otp_sender[-1][1]}
    )
    assert new.status_code == 200


def test_otp_attempt_limit(client: TestClient, otp_sender, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.auth.EMAIL_OTP_MAX_ATTEMPTS", 2)
    email = "attempts@example.com"
    _register(client, email)
    wrong = _different_code(otp_sender[-1][1])
    payload = {"email": email, "otp": wrong}
    assert client.post("/api/auth/verify-email", json=payload).status_code == 400
    limited = client.post("/api/auth/verify-email", json=payload)
    assert limited.status_code == 429
    assert limited.json()["code"] == "OTP_LIMIT"


def test_resend_cooldown(client: TestClient, otp_sender) -> None:
    email = "cooldown@example.com"
    _register(client, email)
    assert len(otp_sender) == 1
    response = client.post("/api/auth/resend-otp", json={"email": email})
    assert response.status_code == 200
    assert len(otp_sender) == 1


def test_logout_clears_browser_cookies(client: TestClient) -> None:
    email = "cookies@example.com"
    _add_user(client, email)
    assert _login(client, email).status_code == 200
    assert client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")

    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    set_cookies = [header.lower() for header in response.headers.get_list("set-cookie")]
    assert any(
        "access_token=" in header and "max-age=0" in header and "path=/" in header
        for header in set_cookies
    )
    assert any(
        "refresh_token=" in header and "max-age=0" in header and "path=/api/auth" in header
        for header in set_cookies
    )
    assert client.cookies.get("access_token") is None
    assert client.cookies.get("refresh_token") is None


def test_logout_revokes_stolen_access_token(client: TestClient) -> None:
    email = "revoked@example.com"
    _add_user(client, email)
    assert _login(client, email).status_code == 200
    stolen_access = client.cookies.get("access_token")
    assert stolen_access
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200

    client.cookies.delete("access_token")
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen_access}"})
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REVOKED"


def test_invalid_credentials_use_standard_error_shape(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "missing@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_CREDENTIALS"


def test_admin_login_rejects_student(client: TestClient) -> None:
    email = "student@example.com"
    _add_user(client, email)
    response = client.post(
        "/api/auth/admin/login", json={"email": email, "password": STRONG_PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_FORBIDDEN"


def test_student_login_rejects_staff(client: TestClient) -> None:
    _add_user(client, "staff@example.com", role="super_admin")
    response = client.post(
        "/api/auth/login", json={"email": "staff@example.com", "password": STRONG_PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_FORBIDDEN"
    assert not client.cookies.get("access_token")


def test_admin_account_can_use_admin_login(client: TestClient) -> None:
    _add_user(client, "admin@example.com", role="super_admin")
    response = client.post(
        "/api/auth/admin/login", json={"email": "admin@example.com", "password": STRONG_PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "super_admin"


def test_google_invalid_token(client: TestClient, monkeypatch) -> None:
    def raise_invalid(*args, **kwargs):
        raise ValueError("invalid")

    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setattr("app.routers.auth.id_token.verify_oauth2_token", raise_invalid)
    response = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert response.status_code == 401
    assert response.json()["code"] == "GOOGLE_INVALID"


def test_google_existing_account_requires_linking(client: TestClient, monkeypatch) -> None:
    email = "google-link@example.com"
    _add_user(client, email)
    monkeypatch.setattr(
        "app.routers.auth._verify_google_credential",
        lambda credential: {"email": email, "sub": "google-sub-1", "name": "Test User"},
    )
    response = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert response.status_code == 409
    assert response.json()["code"] == "GOOGLE_LINK_REQUIRED"


def test_google_existing_linked_account_login(client: TestClient, monkeypatch) -> None:
    email = "google-linked@example.com"
    _add_user(client, email, google_sub="google-sub-2")
    monkeypatch.setattr(
        "app.routers.auth._verify_google_credential",
        lambda credential: {"email": email, "sub": "google-sub-2", "name": "Test User"},
    )
    response = client.post("/api/auth/google", json={"credential": "x" * 40})
    assert response.status_code == 200
    assert client.cookies.get("access_token")


def test_google_link_requires_authenticated_session(client: TestClient, monkeypatch) -> None:
    email = "linkme@example.com"
    monkeypatch.setattr(
        "app.routers.auth._verify_google_credential",
        lambda credential: {"email": email, "sub": "google-link-sub", "name": "Test User"},
    )
    unauthenticated = client.post("/api/auth/google/link", json={"credential": "x" * 40})
    assert unauthenticated.status_code == 401

    _add_user(client, email)
    assert _login(client, email).status_code == 200
    linked = client.post("/api/auth/google/link", json={"credential": "x" * 40})
    assert linked.status_code == 200
    assert linked.json()["message"] == "Google account linked"
