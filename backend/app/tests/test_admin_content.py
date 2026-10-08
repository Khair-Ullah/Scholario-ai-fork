import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models import Document, Notification, Template, User
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
                    role="admin",
                    is_verified=True,
                    plan="pro",
                    referral_code="admin-code",
                ),
                User(
                    email="free@example.com",
                    password_hash=hash_password("test-password-123"),
                    full_name="Free User",
                    role="student",
                    is_verified=True,
                    plan="free",
                    referral_code="free-code",
                ),
                User(
                    email="pro@example.com",
                    password_hash=hash_password("test-password-123"),
                    full_name="Pro User",
                    role="student",
                    is_verified=True,
                    plan="pro",
                    referral_code="pro-code",
                ),
                Template(
                    slug="seed-template",
                    title="Seed Template",
                    category="SOP",
                    description="Seed",
                    body_html="<p>seed</p>",
                    fields_json=[],
                    recommended_word_range=[800, 1000],
                    tips=[],
                    is_premium=False,
                    is_active=True,
                    sort_order=1,
                ),
            ]
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        test_client.post(
            "/api/auth/admin/login",
            json={"email": "admin@example.com", "password": "admin-password-123"},
        )
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_student_cannot_read_content_endpoints(client: TestClient) -> None:
    client.cookies.clear()
    apply_csrf(client)
    registered = client.post(
        "/api/auth/register",
        json={"email": "student-qa@example.com", "password": "test-password-123", "full_name": "QA"},
    )
    assert registered.status_code == 201
    for path in (
        "/api/admin/templates",
        "/api/admin/announcements",
        "/api/admin/payments",
        "/api/admin/settings",
        "/api/admin/audit",
        "/api/admin/ai-stats",
        "/api/admin/data-quality",
    ):
        response = client.get(path)
        assert response.status_code == 403, path
        assert response.json()["code"] == "AUTH_ADMIN_REQUIRED"


def test_template_crud_slug_conflict_and_reorder(client: TestClient) -> None:
    created = client.post(
        "/api/admin/templates",
        json={
            "slug": "ml-sop",
            "title": "ML SOP",
            "category": "SOP",
            "description": "d",
            "body_html": "<p>hi</p>",
            "fields_json": [{"key": "motivation", "label": "Motivation"}],
            "tips": ["be specific"],
            "is_premium": True,
            "sort_order": 5,
        },
    )
    assert created.status_code == 201 or created.status_code == 200
    template_id = created.json()["id"]

    conflict = client.post(
        "/api/admin/templates",
        json={"slug": "ml-sop", "title": "Dup", "category": "SOP"},
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "SLUG_TAKEN"

    patched = client.patch(f"/api/admin/templates/{template_id}", json={"title": "ML SOP v2", "is_active": False})
    assert patched.status_code == 200
    assert patched.json()["title"] == "ML SOP v2"

    reordered = client.post(f"/api/admin/templates/{template_id}/reorder", json={"sort_order": 42})
    assert reordered.status_code == 200
    assert reordered.json()["sort_order"] == 42

    listed = client.get("/api/admin/templates")
    assert listed.status_code == 200
    assert any(item["slug"] == "ml-sop" for item in listed.json())

    deleted = client.delete(f"/api/admin/templates/{template_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/admin/templates/{template_id}").status_code == 404


def test_template_delete_guard_when_documents_reference_it(client: TestClient) -> None:
    created = client.post(
        "/api/admin/templates",
        json={"slug": "in-use-tpl", "title": "In Use", "category": "SOP", "body_html": "<p>x</p>"},
    )
    template_id = created.json()["id"]

    from app.core.deps import get_db
    from app.main import app

    db = next(app.dependency_overrides[get_db]())
    owner = db.query(User).filter(User.email == "free@example.com").first()
    db.add(
        Document(
            user_id=owner.id,
            template_id=template_id,
            title="Draft SOP",
            doc_type="SOP",
            content_html="<p>draft</p>",
        )
    )
    db.commit()

    blocked = client.delete(f"/api/admin/templates/{template_id}")
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "TEMPLATE_IN_USE"
    assert client.get(f"/api/admin/templates/{template_id}").status_code == 200


def test_announcements_deliver_and_are_listed_from_audit(client: TestClient) -> None:
    sent = client.post(
        "/api/admin/announcements",
        json={"title": "Maintenance", "body": "We are down", "audience": "pro", "link": "/dashboard"},
    )
    assert sent.status_code == 200
    assert sent.json()["delivered"] >= 1

    listed = client.get("/api/admin/announcements")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["title"] == "Maintenance"
    assert listed.json()["items"][0]["audience"] == "pro"

    from app.core.deps import get_db
    from app.main import app

    db = next(app.dependency_overrides[get_db]())
    notifications = db.query(Notification).filter(Notification.kind == "announcement").all()
    assert len(notifications) == sent.json()["delivered"]
    assert notifications[0].title == "Maintenance"


def test_payments_grant_transfer_and_summary(client: TestClient) -> None:
    summary = client.get("/api/admin/payments")
    assert summary.status_code == 200
    assert summary.json()["plan_counts"]["pro"] == 2
    assert summary.json()["plan_counts"]["free"] == 1

    granted = client.post(
        "/api/admin/payments/grant",
        json={"user_id": 3, "plan": "free", "note": "refunded"},
    )
    assert granted.status_code == 200
    assert granted.json()["plan"] == "free"

    transfer = client.post(
        "/api/admin/payments/transfer",
        json={"reference": "TR-999", "user_id": 3, "note": "manual bank transfer", "approve": True},
    )
    assert transfer.status_code == 200
    assert transfer.json()["approved"] is True

    history = client.get("/api/admin/payments").json()["history"]
    actions = {item["action"] for item in history}
    assert "payment.grant" in actions
    assert "payment.transfer_approved" in actions


def test_settings_get_patch_and_persistence(client: TestClient) -> None:
    settings = client.get("/api/admin/settings")
    assert settings.status_code == 200
    assert settings.json()["limits"]["free_results"] == 30

    patched = client.patch("/api/admin/settings", json={"limits": {"free_results": 12}})
    assert patched.status_code == 200
    assert patched.json()["limits"]["free_results"] == 12

    again = client.get("/api/admin/settings")
    assert again.json()["limits"]["free_results"] == 12

    flagged = client.patch("/api/admin/settings", json={"flags": {"ai_enabled": False}})
    assert flagged.json()["flags"]["ai_enabled"] is False

    audit = client.get("/api/admin/audit?action=settings.update")
    assert audit.status_code == 200
    assert audit.json()["total"] == 2


def test_audit_list_filters(client: TestClient) -> None:
    client.post("/api/admin/templates", json={"slug": "audit-tpl", "title": "T", "category": "SOP"})
    all_rows = client.get("/api/admin/audit")
    assert all_rows.status_code == 200
    assert all_rows.json()["total"] >= 1

    by_entity = client.get("/api/admin/audit?entity=template")
    assert by_entity.status_code == 200
    assert by_entity.json()["total"] >= 1
    assert all(item["entity"] == "template" for item in by_entity.json()["items"])

    by_actor = client.get("/api/admin/audit?actor=admin@example.com")
    assert by_actor.status_code == 200
    assert by_actor.json()["total"] >= 1

    empty = client.get("/api/admin/audit?action=nope.nope")
    assert empty.json()["total"] == 0


def test_ai_stats_returns_usage(client: TestClient) -> None:
    response = client.get("/api/admin/ai-stats")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"sessions", "messages_7d", "tokens_total", "by_provider", "recent_sessions"}
    assert isinstance(body["sessions"], int)
    assert isinstance(body["recent_sessions"], list)
