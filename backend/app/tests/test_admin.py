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
                    role="admin",
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
    assert response.json()["code"] == "AUTH_ADMIN_REQUIRED"


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
