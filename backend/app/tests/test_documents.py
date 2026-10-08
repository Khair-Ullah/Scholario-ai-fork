import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.services.templates_seed import seed_templates
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
        seed_templates(session)
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


def test_document_save_sanitize_versions_restore_and_export(client: TestClient) -> None:
    register(client, "writer@example.com")
    template = client.get("/api/templates/statement-of-purpose-masters")
    assert template.status_code == 200
    created = client.post(
        "/api/documents",
        json={
            "title": "My SOP",
            "template_id": template.json()["id"],
            "content_html": "<p>My first draft</p><script>alert('x')</script>",
            "placeholders_json": {"full_name": "Writer"},
        },
    )
    assert created.status_code == 201
    document_id = created.json()["id"]
    assert "<script" not in created.json()["content_html"]
    assert created.json()["word_count"] == 3

    updated = client.put(f"/api/documents/{document_id}", json={"content_html": "<p>My revised draft</p>"})
    assert updated.status_code == 200
    assert updated.json()["version"] == 2
    assert len(client.get(f"/api/documents/{document_id}/versions").json()) == 2

    restored = client.post(f"/api/documents/{document_id}/restore/1")
    assert restored.status_code == 200
    assert restored.json()["version"] == 3
    assert "My first draft" in restored.json()["content_html"]

    exported = client.get(f"/api/documents/{document_id}/export", params={"format": "txt"})
    assert exported.status_code == 200
    assert "My first draft" in exported.text


def test_user_cannot_read_or_change_another_users_document(client: TestClient) -> None:
    register(client, "owner@example.com")
    created = client.post("/api/documents", json={"title": "Private draft", "content_html": "<p>Private text</p>"})
    document_id = created.json()["id"]

    client.cookies.clear()
    from app.tests.helpers import apply_csrf, reset_csrf

    reset_csrf(client)
    apply_csrf(client)
    register(client, "visitor@example.com")
    apply_csrf(client)
    assert client.get(f"/api/documents/{document_id}").status_code == 404
    assert client.put(f"/api/documents/{document_id}", json={"title": "Changed"}).status_code == 404
    assert client.get(f"/api/documents/{document_id}/export", params={"format": "txt"}).status_code == 404
    assert client.get("/api/documents").json() == []
