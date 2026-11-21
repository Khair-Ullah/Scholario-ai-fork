import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.models import Notification, Scholarship
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
        session.add(
            Scholarship(
                scholarship_id="PRIVATE-1",
                title="Test Opportunity",
                level="Master",
                university_name="Sample University",
                scholarship_type="Fully Funded",
                host_country="Germany",
                ielts_required=False,
                ielts_band=None,
                ielts_tier=0,
                fields_list=["Engineering & Technology"],
                docs_list=["Academic Transcripts"],
                deadline_kind="unspecified",
                selection_ratio_percent=4.5,
                is_active=True,
                search_text="test opportunity",
                source_data={
                    "attestation_required": "Y",
                    "medical_certificate_required": "False",
                    "police_clearance_required": "True",
                },
            )
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def register(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "test-password-123", "full_name": email.split("@")[0]}
    )
    assert response.status_code == 201


def test_saved_scholarship_is_private_per_user(client: TestClient) -> None:
    register(client, "first@example.com")
    saved = client.post("/api/saved", json={"scholarship_id": "PRIVATE-1", "note": "Prepare transcripts"})
    assert saved.status_code == 201
    assert len(client.get("/api/saved").json()) == 1

    client.cookies.clear()
    from app.tests.helpers import apply_csrf, reset_csrf

    reset_csrf(client)
    apply_csrf(client)
    register(client, "second@example.com")
    apply_csrf(client)
    assert client.get("/api/saved").json() == []
    assert client.delete("/api/saved/PRIVATE-1").status_code == 200


def test_tracker_updates_and_cannot_be_read_by_another_user(client: TestClient) -> None:
    register(client, "owner@example.com")
    created = client.post("/api/applications", json={"scholarship_id": "PRIVATE-1", "status": "planning"})
    assert created.status_code == 201
    application_id = created.json()["id"]
    assert (
        client.patch(f"/api/applications/{application_id}", json={"status": "submitted"}).json()["status"]
        == "submitted"
    )

    client.cookies.clear()
    from app.tests.helpers import apply_csrf, reset_csrf

    reset_csrf(client)
    apply_csrf(client)
    register(client, "other@example.com")
    apply_csrf(client)
    assert client.get("/api/applications").json() == []
    assert client.patch(f"/api/applications/{application_id}", json={"status": "accepted"}).status_code == 404


def test_ready_endpoint_checks_database(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.parametrize("path", ["/api/health", "/api/ready"])
def test_health_aliases_work_through_api_proxy(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 200
    assert "status" in response.json()


def test_notifications_endpoint_returns_serialized_items(client: TestClient) -> None:
    register(client, "notified@example.com")
    user_id = client.get("/api/auth/me").json()["id"]
    db = next(app.dependency_overrides[get_db]())
    try:
        db.add(Notification(user_id=user_id, title="Update", body="Your account is ready.", kind="system"))
        db.commit()
    finally:
        db.close()

    response = client.get("/api/notifications")
    assert response.status_code == 200
    assert response.json()["unread_count"] == 1
    assert response.json()["items"][0]["title"] == "Update"


def test_generated_checklist_contains_only_required_items_and_is_repeatable(client: TestClient) -> None:
    register(client, "checklist@example.com")
    generated = client.post("/api/checklist/generate/PRIVATE-1")
    assert generated.status_code == 200
    titles = {item["title"] for item in generated.json()}
    assert titles == {"Academic Transcripts", "Complete document attestation", "Obtain police clearance"}
    assert client.post("/api/checklist/generate/PRIVATE-1").json() == []
