import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import Scholarship, UniversityCountry, User
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
                    referral_code="admin-test-code",
                ),
                Scholarship(
                    scholarship_id="ADMIN-1",
                    title="Admin Award",
                    level="Master",
                    university_name="Admin University",
                    scholarship_type="Fully Funded",
                    host_country="Unknown",
                    ielts_required=False,
                    ielts_tier=0,
                    fields_list=[],
                    docs_list=[],
                    deadline_kind="unspecified",
                    is_active=True,
                    search_text="admin award",
                    source_data={},
                ),
                UniversityCountry(university_name="Admin University", host_country="Unknown", confidence=0),
            ]
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_admin_routes_reject_students(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "student@example.com", "password": "test-password-123", "full_name": "Student"},
    )
    response = client.get("/api/admin/stats")
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_FORBIDDEN"


def test_admin_can_edit_scholarship_and_country_mapping(client: TestClient) -> None:
    login = client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    assert login.status_code == 200
    updated = client.patch("/api/admin/scholarships/ADMIN-1", json={"application_url": "https://example.org/apply"})
    assert updated.status_code == 200
    assert updated.json()["application_url"] == "https://example.org/apply"

    country = client.patch(
        "/api/admin/universities/Admin%20University/country", json={"host_country": "Germany", "confidence": 1}
    )
    assert country.status_code == 200
    assert country.json()["host_country"] == "Germany"
    assert client.get("/api/admin/universities/unmapped").json() == []


def test_admin_can_upload_csv_and_get_import_report(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=["scholarship_id", "title", "university_name", "IELTS_required", "IELTS_band_recommendation"]
    )
    writer.writeheader()
    writer.writerow(
        {
            "scholarship_id": "CSV-1",
            "title": "Imported award",
            "university_name": "Upload University",
            "IELTS_required": "False",
        }
    )
    response = client.post(
        "/api/admin/scholarships/import-csv", files={"file": ("scholarships.csv", buffer.getvalue(), "text/csv")}
    )
    assert response.status_code == 200
    assert response.json()["import"]["rows_read"] == 1
    assert response.json()["import"]["inserted"] == 1


def test_stats_v2_returns_operational_metrics(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    response = client.get("/api/admin/stats")
    assert response.status_code == 200
    body = response.json()
    for key in (
        "users",
        "new_today",
        "new_7d",
        "pro_users",
        "active_scholarships",
        "documents",
        "ai_messages_7d",
        "signups_by_day",
        "top_saved",
        "latest_users",
    ):
        assert key in body, key
    assert isinstance(body["users"], int)
    assert isinstance(body["signups_by_day"], list)
    assert isinstance(body["top_saved"], list)


def test_scholarship_create_update_delete_flow(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    created = client.post(
        "/api/admin/scholarships",
        json={
            "scholarship_id": "FLOW-1",
            "title": "Flow Award",
            "university_name": "Flow University",
            "host_country": "Canada",
            "level": "Bachelor",
            "scholarship_type": "Partial",
            "deadline_kind": "anytime",
            "fields_list": ["Engineering & Technology"],
            "application_url": "https://example.org/apply",
        },
    )
    assert created.status_code == 200
    assert created.json()["scholarship_id"] == "FLOW-1"

    duplicate = client.post(
        "/api/admin/scholarships",
        json={"scholarship_id": "FLOW-1", "title": "Dup"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "SCHOLARSHIP_EXISTS"

    patched = client.patch(
        "/api/admin/scholarships/FLOW-1",
        json={"ielts_required": True, "ielts_band": "6.5+", "ielts_tier": 1, "deadline_kind": "unspecified"},
    )
    assert patched.status_code == 200
    assert patched.json()["is_active"] is True

    created_active = client.get("/api/admin/scholarships?q=flow&is_active=true")
    assert created_active.status_code == 200
    assert created_active.json()["total"] == 1

    deleted = client.delete("/api/admin/scholarships/FLOW-1")
    assert deleted.status_code == 200
    assert client.delete("/api/admin/scholarships/FLOW-1").status_code == 404


def test_scholarship_delete_guard_when_saved(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    client.post(
        "/api/auth/register",
        json={"email": "saver@example.com", "password": "test-password-123", "full_name": "Saver"},
    )
    saved = client.post("/api/saved", json={"scholarship_id": "ADMIN-1", "note": "keep"})
    assert saved.status_code in (200, 201)
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})

    blocked = client.delete("/api/admin/scholarships/ADMIN-1")
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "SCHOLARSHIP_IN_USE"


def test_bulk_activate_deactivate_and_missing_ids(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    deactivated = client.post(
        "/api/admin/scholarships/bulk", json={"ids": ["ADMIN-1"], "action": "deactivate"}
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["updated"] == 1
    assert deactivated.json()["affected"] == ["ADMIN-1"]

    listed = client.get("/api/admin/scholarships?is_active=false")
    assert listed.json()["total"] == 1

    reactivated = client.post("/api/admin/scholarships/bulk", json={"ids": ["ADMIN-1"], "action": "activate"})
    assert reactivated.json()["updated"] == 1

    missing = client.post("/api/admin/scholarships/bulk", json={"ids": ["NOPE", "ADMIN-1"], "action": "activate"})
    assert missing.json()["missing"] == ["NOPE"]

    invalid = client.post("/api/admin/scholarships/bulk", json={"ids": ["ADMIN-1"], "action": "explode"})
    assert invalid.status_code == 422


def test_export_csv_streams_attachment(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    response = client.get("/api/admin/scholarships/export-csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    body = response.text
    assert "scholarship_id" in body.splitlines()[0]
    assert "ADMIN-1" in body


def test_import_dry_run_does_not_persist(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=["scholarship_id", "title", "university_name", "IELTS_required"]
    )
    writer.writeheader()
    writer.writerow(
        {"scholarship_id": "DRY-1", "title": "Dry run", "university_name": "Dry U", "IELTS_required": "False"}
    )
    response = client.post(
        "/api/admin/scholarships/import-csv/dry-run",
        files={"file": ("dry.csv", buffer.getvalue(), "text/csv")},
    )
    assert response.status_code == 200
    body = response.json()["import"]
    assert body["dry_run"] is True
    assert body["rows_read"] == 1
    assert body["would_insert"] == 1
    assert len(body["preview"]) == 1
    assert client.get("/api/admin/scholarships?q=dry").json()["total"] == 0


def test_data_quality_queues(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    for queue in ("unmapped", "missing_deadline", "missing_url", "ielts_missing_band"):
        response = client.get(f"/api/admin/data-quality?queue={queue}")
        assert response.status_code == 200, queue
        body = response.json()
        assert body["queue"] == queue
        assert "items" in body and "total" in body
        assert set(body["counts"]) == {"unmapped", "missing_deadline", "missing_url", "ielts_missing_band"}

    bad = client.get("/api/admin/data-quality?queue=nope")
    assert bad.status_code == 400
    assert bad.json()["code"] == "UNKNOWN_QUEUE"


def test_user_list_filters_counts_and_detail(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    listed = client.get("/api/admin/users?role=super_admin")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["counts"]["admins"] == 1
    assert all(item["role"] == "super_admin" for item in listed.json()["items"])

    all_users = client.get("/api/admin/users")
    assert all_users.json()["counts"]["total"] >= 1

    detail = client.get("/api/admin/users/1")
    assert detail.status_code == 200
    body = detail.json()
    assert body["email"] == "admin@example.com"
    assert "stats" in body and "sessions" in body and "profile" in body
    assert body["stats"]["saved"] >= 0

    pro_filter = client.get("/api/admin/users?plan=free")
    assert all(item["plan"] == "free" for item in pro_filter.json()["items"])

    missing = client.get("/api/admin/users/99999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "USER_NOT_FOUND"


def test_user_sessions_and_onboarding_endpoints(client: TestClient) -> None:
    client.post("/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"})
    sessions = client.get("/api/admin/users/1/sessions")
    assert sessions.status_code == 200
    assert isinstance(sessions.json(), list)

    onboarding = client.get("/api/admin/users/1/onboarding")
    assert onboarding.status_code == 200

    revoked = client.post("/api/admin/users/1/revoke-sessions")
    assert revoked.status_code == 200
    assert isinstance(revoked.json()["revoked"], int)

    reauth = client.post(
        "/api/auth/admin/login", json={"email": "admin@example.com", "password": "admin-password-123"}
    )
    assert reauth.status_code == 200

    reset = client.post("/api/admin/users/1/reset-onboarding")
    assert reset.status_code == 200
    assert reset.json()["onboarding_step"] == 1
    assert reset.json()["onboarding_completed"] is False
