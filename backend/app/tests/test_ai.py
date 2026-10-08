import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.models import Scholarship
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
        session.add(
            Scholarship(
                scholarship_id="AI-1",
                title="Example Graduate Award",
                level="Master",
                university_name="Example University",
                scholarship_type="Fully Funded",
                host_country="Germany",
                ielts_required=True,
                ielts_band="7+",
                ielts_tier=2,
                fields_list=["Engineering & Technology"],
                docs_list=["Academic Transcripts"],
                deadline_kind="fixed",
                selection_ratio_percent=3.33,
                is_active=True,
                search_text="example graduate award example university",
                source_data={"deadline": "19 Mar 2027", "funding": "Tuition and stipend", "IELTS_required": "True"},
            )
        )
        session.commit()
    with TestClient(app) as test_client:
        apply_csrf(test_client)
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def register(client: TestClient, email: str) -> None:
    assert (
        client.post(
            "/api/auth/register", json={"email": email, "password": "test-password-123", "full_name": "AI Student"}
        ).status_code
        == 201
    )


def test_advisor_uses_scholarship_data_and_persists_private_session(client: TestClient) -> None:
    register(client, "advisor@example.com")
    response = client.post("/api/ai/chat", json={"message": "What is the deadline for Example Graduate Award?"})
    assert response.status_code == 200
    assert "19 Mar 2027" in response.json()["message"]["content"]
    assert "Demo AI" in response.json()["message"]["content"]
    session_id = response.json()["session_id"]
    assert len(client.get(f"/api/ai/sessions/{session_id}").json()["messages"]) == 2

    client.cookies.clear()
    from app.tests.helpers import apply_csrf, reset_csrf

    reset_csrf(client)
    apply_csrf(client)
    register(client, "other-advisor@example.com")
    assert client.get(f"/api/ai/sessions/{session_id}").status_code == 404


def test_mock_review_and_improve_endpoints_return_structured_results(client: TestClient) -> None:
    register(client, "writer@example.com")
    review = client.post(
        "/api/ai/sop-review",
        json={
            "text": "I plan to study engineering at Example University. My research project built a low-cost sensor."
        },
    )
    assert review.status_code == 200
    assert 0 <= review.json()["score"] <= 100
    assert {"structure", "clarity", "goals", "evidence", "grammar", "fit"} == set(review.json()["sub_scores"])

    improved = client.post("/api/ai/improve-text", json={"text": "I study engineering", "instruction": "clarity"})
    assert improved.status_code == 200
    assert improved.json()["provider"] == "mock"
    assert "Demo AI suggestion" in improved.json()["text"]


def test_template_answers_are_sanitized(client: TestClient) -> None:
    register(client, "template-writer@example.com")
    result = client.post(
        "/api/ai/fill-template",
        json={"slug": "statement-of-purpose-masters", "answers": {"full_name": "<script>alert(1)</script>Student"}},
    )
    assert result.status_code == 200
    assert "<script" not in result.json()["content_html"].lower()
