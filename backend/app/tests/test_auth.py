import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import User
from app.tests.helpers import apply_csrf


@pytest.fixture
def client():
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


def test_register_me_refresh_and_logout(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "Student@example.com",
            "password": "a-strong-test-password",
            "full_name": "Test Student",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["email"] == "student@example.com"
    assert "password_hash" not in response.json()["user"]
    assert response.cookies.get("access_token")
    assert client.get("/api/auth/me").json()["full_name"] == "Test Student"

    old_refresh = client.cookies.get("refresh_token")
    refresh_response = client.post("/api/auth/refresh")
    assert refresh_response.status_code == 200
    assert client.cookies.get("refresh_token") != old_refresh

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_logout_revokes_stolen_access_token(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "email": "revoked@example.com",
            "password": "a-strong-test-password",
            "full_name": "Revoked Student",
        },
    )
    stolen_access = client.cookies.get("access_token")
    assert stolen_access
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200

    client.cookies.delete("access_token")
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen_access}"})
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_REVOKED"


def test_invalid_credentials_use_standard_error_shape(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong-password"})
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_CREDENTIALS"


def test_admin_login_rejects_student(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "email": "student@example.com",
            "password": "a-strong-test-password",
            "full_name": "Test Student",
        },
    )
    response = client.post(
        "/api/auth/admin/login", json={"email": "student@example.com", "password": "a-strong-test-password"}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_FORBIDDEN"


def test_student_login_rejects_staff(client: TestClient) -> None:
    override = app.dependency_overrides[get_db]
    session_generator = override()
    session = next(session_generator)
    session.add(
        User(
            email="staff@example.com",
            password_hash=hash_password("a-strong-admin-password"),
            full_name="Test Admin",
            role="super_admin",
            is_verified=True,
            referral_code="test-staff-ref",
        )
    )
    session.commit()
    session.close()

    response = client.post(
        "/api/auth/login", json={"email": "staff@example.com", "password": "a-strong-admin-password"}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_FORBIDDEN"
    assert not client.cookies.get("access_token")


def test_admin_account_can_use_admin_login(client: TestClient) -> None:
    override = app.dependency_overrides[get_db]
    session_generator = override()
    session = next(session_generator)
    session.add(
        User(
            email="admin@example.com",
            password_hash=hash_password("a-strong-admin-password"),
            full_name="Test Admin",
            role="super_admin",
            is_verified=True,
            referral_code="test-admin-ref",
        )
    )
    session.commit()
    session.close()

    response = client.post(
        "/api/auth/admin/login", json={"email": "admin@example.com", "password": "a-strong-admin-password"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "super_admin"
