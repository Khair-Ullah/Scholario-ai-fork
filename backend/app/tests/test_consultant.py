from datetime import UTC, datetime

import pyotp
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import AuditLog, Scholarship, User
from app.services import anomaly
from app.tests.helpers import apply_csrf


def _scholarship(scholarship_id: str, title: str, owner_id: int | None) -> Scholarship:
    return Scholarship(
        scholarship_id=scholarship_id,
        title=title,
        owner_id=owner_id,
        level="Master",
        university_name=f"{title} University",
        scholarship_type="Fully Funded",
        host_country="Germany",
        ielts_required=False,
        ielts_tier=0,
        fields_list=[],
        docs_list=[],
        deadline_kind="unspecified",
        is_active=True,
        search_text=title.lower(),
        source_data={},
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
        admin = User(
            email="admin@example.com",
            password_hash=hash_password("admin-password-123"),
            full_name="Admin",
            role="super_admin",
            is_verified=True,
            plan="pro",
            referral_code="admin-code",
        )
        consultant = User(
            email="consultant@example.com",
            password_hash=hash_password("consultant-password-123"),
            full_name="Consultant",
            role="consultant",
            is_verified=True,
            referral_code="consultant-code",
        )
        student = User(
            email="student@example.com",
            password_hash=hash_password("student-password-123"),
            full_name="Student",
            role="student",
            is_verified=True,
            referral_code="student-code",
        )
        session.add_all([admin, consultant, student])
        session.flush()
        session.add_all(
            [
                _scholarship("CONS-1", "Consultant Award", consultant.id),
                _scholarship("ADMIN-1", "Platform Award", None),
            ]
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def _login(client: TestClient, path: str, email: str, password: str, code: str | None = None):
    payload: dict[str, str] = {"email": email, "password": password}
    if code is not None:
        payload["totp_code"] = code
    return client.post(path, json=payload)


def test_panels_enforce_roles(client: TestClient) -> None:
    _login(client, "/api/auth/login", "student@example.com", "student-password-123")
    assert client.get("/api/consultant/stats").status_code == 403
    assert client.get("/api/consultant/stats").json()["code"] == "AUTH_FORBIDDEN"
    assert client.get("/api/admin/stats").status_code == 403

    assert (
        _login(client, "/api/auth/consultant/login", "consultant@example.com", "consultant-password-123").status_code
        == 200
    )
    assert client.get("/api/consultant/stats").status_code == 200
    admin_blocked = client.get("/api/admin/stats")
    assert admin_blocked.status_code == 403
    assert admin_blocked.json()["code"] == "AUTH_FORBIDDEN"

    assert _login(client, "/api/auth/admin/login", "admin@example.com", "admin-password-123").status_code == 200
    assert client.get("/api/admin/stats").status_code == 200


def test_staff_login_endpoints_reject_other_roles(client: TestClient) -> None:
    assert (
        _login(client, "/api/auth/consultant/login", "student@example.com", "student-password-123").status_code == 403
    )
    assert (
        _login(client, "/api/auth/consultant/login", "admin@example.com", "admin-password-123").json()["code"]
        == "AUTH_FORBIDDEN"
    )
    assert (
        _login(client, "/api/auth/admin/login", "consultant@example.com", "consultant-password-123").status_code == 403
    )


def test_consultant_only_reaches_owned_scholarships(client: TestClient) -> None:
    _login(client, "/api/auth/consultant/login", "consultant@example.com", "consultant-password-123")
    listed = client.get("/api/consultant/scholarships")
    assert listed.status_code == 200
    ids = [item["scholarship_id"] for item in listed.json()["items"]]
    assert ids == ["CONS-1"]

    hidden = client.get("/api/consultant/scholarships/ADMIN-1")
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "SCHOLARSHIP_NOT_FOUND"
    assert client.patch("/api/consultant/scholarships/ADMIN-1", json={"title": "hijack"}).status_code == 404
    assert client.delete("/api/consultant/scholarships/ADMIN-1").status_code == 404


def test_consultant_create_assigns_ownership(client: TestClient) -> None:
    _login(client, "/api/auth/consultant/login", "consultant@example.com", "consultant-password-123")
    me = client.get("/api/auth/me").json()
    created = client.post(
        "/api/consultant/scholarships",
        json={"scholarship_id": "NEW-1", "title": "Fresh Award", "level": "PhD"},
    )
    assert created.status_code == 200
    assert created.json()["owner_id"] == me["id"]
    assert client.get("/api/consultant/stats").json()["scholarships"] == 2

    duplicate = client.post("/api/consultant/scholarships", json={"scholarship_id": "NEW-1", "title": "Dup"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "SCHOLARSHIP_EXISTS"


def test_super_admin_reassigns_scholarship_owner(client: TestClient) -> None:
    _login(client, "/api/auth/admin/login", "admin@example.com", "admin-password-123")
    consultant_id = client.get("/api/admin/consultants").json()["items"][0]["id"]

    reassigned = client.patch("/api/admin/scholarships/ADMIN-1", json={"owner_id": consultant_id})
    assert reassigned.status_code == 200
    assert reassigned.json()["owner_id"] == consultant_id

    _login(client, "/api/auth/consultant/login", "consultant@example.com", "consultant-password-123")
    now_visible = client.get("/api/consultant/scholarships/ADMIN-1")
    assert now_visible.status_code == 200
    assert now_visible.json()["scholarship_id"] == "ADMIN-1"


def test_admin_creates_consultant_warns_and_consultant_acknowledges(client: TestClient) -> None:
    _login(client, "/api/auth/admin/login", "admin@example.com", "admin-password-123")
    created = client.post(
        "/api/admin/consultants",
        json={"email": "newbie@example.com", "password": "newbie-password-123", "full_name": "Newbie"},
    )
    assert created.status_code == 201
    new_id = created.json()["id"]
    assert created.json()["scholarships"] == 0

    warned = client.post(
        f"/api/admin/consultants/{new_id}/warn",
        json={"severity": "warning", "reason": "Review your listings", "detail": "Several links look broken."},
    )
    assert warned.status_code == 200
    warning_id = warned.json()["id"]
    assert warned.json()["category"] == "manual"

    assert client.get("/api/admin/warnings").json()["total"] >= 1

    _login(client, "/api/auth/consultant/login", "newbie@example.com", "newbie-password-123")
    mine = client.get("/api/consultant/warnings").json()
    assert any(item["id"] == warning_id and not item["is_acknowledged"] for item in mine)

    acked = client.post(f"/api/consultant/warnings/{warning_id}/ack")
    assert acked.status_code == 200
    assert acked.json()["is_acknowledged"] is True
    assert client.get("/api/consultant/warnings?include_acknowledged=false").json() == []


def test_two_factor_login_flow(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "mfa@example.com", "password": "mfa-password-123", "full_name": "MFA User"},
    )
    setup = client.post("/api/auth/mfa/setup")
    assert setup.status_code == 200
    secret = setup.json()["secret"]

    code = pyotp.TOTP(secret).now()
    enabled = client.post("/api/auth/mfa/enable", json={"code": code})
    assert enabled.status_code == 200
    recovery_codes = enabled.json()["recovery_codes"]
    assert len(recovery_codes) == 8

    status = client.get("/api/auth/mfa/status").json()
    assert status["enabled"] is True

    client.post("/api/auth/logout")

    missing = client.post("/api/auth/login", json={"email": "mfa@example.com", "password": "mfa-password-123"})
    assert missing.status_code == 401
    assert missing.json()["code"] == "MFA_REQUIRED"

    bad = client.post(
        "/api/auth/login", json={"email": "mfa@example.com", "password": "mfa-password-123", "totp_code": "000000"}
    )
    assert bad.status_code == 401
    assert bad.json()["code"] == "MFA_INVALID"

    good = client.post(
        "/api/auth/login",
        json={"email": "mfa@example.com", "password": "mfa-password-123", "totp_code": pyotp.TOTP(secret).now()},
    )
    assert good.status_code == 200

    client.post("/api/auth/logout")
    recovery_login = client.post(
        "/api/auth/login",
        json={"email": "mfa@example.com", "password": "mfa-password-123", "totp_code": recovery_codes[0]},
    )
    assert recovery_login.status_code == 200


def test_login_locks_after_repeated_failures(client: TestClient) -> None:
    for _ in range(5):
        attempt = client.post(
            "/api/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"}
        )
        assert attempt.status_code == 401

    locked = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"})
    assert locked.status_code == 429
    assert locked.json()["code"] == "AUTH_LOCKED"


def test_anomaly_service_flags_deletion_burst_and_dedupes(client: TestClient) -> None:
    override = app.dependency_overrides[get_db]
    session = next(override())
    consultant = session.query(User).filter_by(email="consultant@example.com").one()
    for _ in range(anomaly.RULES[0][2]):
        session.add(
            AuditLog(
                actor_id=consultant.id,
                actor_email=consultant.email,
                action="scholarship.delete",
                entity="scholarship",
                created_at=datetime.now(UTC),
            )
        )
    session.commit()

    created = anomaly.evaluate_consultant(session, consultant)
    session.commit()
    assert [warning.category for warning in created] == ["bulk_delete"]

    again = anomaly.evaluate_consultant(session, consultant)
    assert again == []
