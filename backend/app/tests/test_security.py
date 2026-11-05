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
from app.models import AuditLog, Scholarship, User
from app.tests.helpers import apply_csrf


@pytest.fixture
def security_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with test_session() as session:
        session.add_all(
            [
                User(
                    email="admin@example.com",
                    password_hash=hash_password("admin-password-123"),
                    full_name="Admin",
                    role="super_admin",
                    is_verified=True,
                    plan="pro",
                    referral_code="admin-sec-code",
                ),
                Scholarship(
                    scholarship_id="SEC-1",
                    title="Security Award",
                    level="Master",
                    university_name="Security University",
                    scholarship_type="Fully Funded",
                    host_country="Unknown",
                    ielts_required=False,
                    ielts_tier=0,
                    fields_list=[],
                    docs_list=[],
                    deadline_kind="unspecified",
                    is_active=True,
                    search_text="security award",
                    source_data={},
                ),
            ]
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def _login_admin(client: TestClient) -> int:
    response = client.post(
        "/api/auth/admin/login",
        json={"email": "admin@example.com", "password": "admin-password-123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["user"]["id"]


def _audit_entries() -> list[AuditLog]:
    session_factory = app.dependency_overrides[get_db]
    session = next(session_factory())
    try:
        return list(session.scalars(select(AuditLog)).all())
    finally:
        session.close()


def test_security_headers_present(security_client: TestClient) -> None:
    response = security_client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_csrf_token_required_for_mutations(security_client: TestClient) -> None:
    bare = TestClient(app)
    response = bare.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin-password-123"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_FAILED"


def test_csrf_round_trip_sets_cookie(security_client: TestClient) -> None:
    fresh = TestClient(app)
    first = fresh.get("/api/auth/csrf")
    assert first.status_code == 200
    token = first.json()["token"]
    assert fresh.cookies.get("csrftoken")
    second = fresh.get("/api/auth/csrf")
    assert second.json()["token"] == token


def test_admin_login_rate_limit(security_client: TestClient) -> None:
    limiter.enabled = True
    try:
        statuses = []
        for _ in range(6):
            response = security_client.post(
                "/api/auth/admin/login",
                json={"email": "admin@example.com", "password": "admin-password-123"},
            )
            statuses.append(response.status_code)
        assert 429 in statuses
        last = security_client.post(
            "/api/auth/admin/login",
            json={"email": "admin@example.com", "password": "admin-password-123"},
        )
        assert last.status_code == 429
        assert last.json()["code"] == "RATE_LIMITED"
    finally:
        limiter.enabled = False


def test_self_lockout_blocked_when_other_admin_exists(security_client: TestClient) -> None:
    admin_id = _login_admin(security_client)
    db = next(app.dependency_overrides[get_db]())
    try:
        db.add(
            User(
                email="admin2@example.com",
                password_hash=hash_password("admin-password-123"),
                full_name="Admin Two",
                role="super_admin",
                is_verified=True,
                plan="pro",
                referral_code="admin-sec-code-2",
            )
        )
        db.commit()
    finally:
        db.close()
    response = security_client.patch(f"/api/admin/users/{admin_id}", json={"is_active": False})
    assert response.status_code == 400
    assert response.json()["code"] == "SELF_LOCKOUT"


def test_last_admin_guard_blocks_self_demotion(security_client: TestClient) -> None:
    admin_id = _login_admin(security_client)
    response = security_client.patch(f"/api/admin/users/{admin_id}", json={"role": "student"})
    assert response.status_code == 409
    assert response.json()["code"] == "LAST_SUPER_ADMIN"


def test_scholarship_update_writes_audit_log(security_client: TestClient) -> None:
    _login_admin(security_client)
    response = security_client.patch(
        "/api/admin/scholarships/SEC-1", json={"application_url": "https://example.edu/apply"}
    )
    assert response.status_code == 200, response.text
    entries = [entry for entry in _audit_entries() if entry.action == "scholarship.update"]
    assert entries, "expected a scholarship.update audit entry"
    entry = entries[-1]
    assert entry.actor_email == "admin@example.com"
    assert entry.entity_id == "SEC-1"
    assert entry.diff is not None
    assert "application_url" in entry.diff["after"]


def test_failed_admin_login_is_audited(security_client: TestClient) -> None:
    response = security_client.post(
        "/api/auth/admin/login",
        json={"email": "admin@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    entries = [entry for entry in _audit_entries() if entry.action == "auth.admin_login_failed"]
    assert entries
    assert entries[-1].actor_email == "admin@example.com"


def test_successful_admin_login_is_audited(security_client: TestClient) -> None:
    _login_admin(security_client)
    entries = [entry for entry in _audit_entries() if entry.action == "auth.admin_login"]
    assert entries
