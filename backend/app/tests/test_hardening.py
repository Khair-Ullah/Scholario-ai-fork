from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import Setting, User
from app.services.entitlements import is_pro
from app.tests.helpers import apply_csrf


def _make_user(email: str, password: str, role: str = "student", **kwargs) -> User:
    return User(
        email=email,
        password_hash=hash_password(password),
        full_name=email.split("@")[0].title(),
        role=role,
        is_verified=True,
        referral_code=f"ref-{email.split('@')[0]}",
        **kwargs,
    )


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with test_session() as session:
        session.add(
            _make_user("admin@example.com", "admin-password-123", role="super_admin", plan="pro")
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        test_client.session_factory = test_session  # type: ignore[attr-defined]
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def _set_flags(client: TestClient, **flags) -> None:
    session_factory = client.session_factory  # type: ignore[attr-defined]
    with session_factory() as session:
        session.add(Setting(key="flags", value=flags))
        session.commit()


def test_is_pro_respects_plan_and_expiry() -> None:
    now = datetime.now(UTC)
    assert is_pro(_make_user("a@example.com", "x" * 8, plan="free")) is False
    assert is_pro(_make_user("b@example.com", "x" * 8, plan="pro")) is True
    assert is_pro(_make_user("c@example.com", "x" * 8, plan="pro", plan_expires_at=now + timedelta(days=1))) is True
    assert is_pro(_make_user("d@example.com", "x" * 8, plan="pro", plan_expires_at=now - timedelta(days=1))) is False


def test_registration_disabled_flag_blocks_signup(client: TestClient) -> None:
    _set_flags(client, registration_enabled=False, ai_enabled=True, announcements_enabled=True)
    response = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "a-strong-password", "full_name": "New Student"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "REGISTRATION_DISABLED"


def test_refresh_token_reuse_revokes_all_sessions(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "reuse@example.com", "password": "a-strong-password", "full_name": "Reuse Student"},
    )
    original_refresh = client.cookies.get("refresh_token")
    assert original_refresh

    assert client.post("/api/auth/refresh").status_code == 200

    client.cookies.delete("refresh_token", path="/api/auth")
    client.cookies.set("refresh_token", original_refresh, path="/api/auth")
    reuse = client.post("/api/auth/refresh")
    assert reuse.status_code == 401
    assert reuse.json()["code"] == "REFRESH_REUSED"

    assert client.get("/api/auth/me").status_code == 401


def test_change_password_revokes_existing_access_token(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "pw@example.com", "password": "a-strong-password", "full_name": "Pw Student"},
    )
    stolen_access = client.cookies.get("access_token")
    assert stolen_access

    changed = client.post(
        "/api/users/me/password",
        json={"current_password": "a-strong-password", "new_password": "a-new-strong-password"},
    )
    assert changed.status_code == 200

    client.cookies.delete("access_token")
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen_access}"})
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REVOKED"


def test_export_csv_neutralises_formula_injection(client: TestClient) -> None:
    login = client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    assert login.status_code == 200

    created = client.post(
        "/api/admin/scholarships",
        json={
            "scholarship_id": "FORMULA-1",
            "title": "=cmd|'/C calc'!A1",
            "application_url": "https://example.com/apply",
        },
    )
    assert created.status_code in (200, 201)

    response = client.get("/api/admin/scholarships/export-csv")
    assert response.status_code == 200
    assert "'=cmd" in response.text


def test_admin_page_size_is_clamped(client: TestClient) -> None:
    login = client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    assert login.status_code == 200

    assert client.get("/api/admin/users", params={"page_size": 0}).status_code == 200
    assert client.get("/api/admin/users", params={"page_size": 100000}).status_code == 200
