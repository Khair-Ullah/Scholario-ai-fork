import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.main import app
from app.models import Scholarship


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
        for tier in range(4):
            session.add(
                Scholarship(
                    scholarship_id=f"M-{tier}",
                    title=f"Award {tier}",
                    level="Master",
                    university_name=f"University {tier}",
                    scholarship_type="Fully Funded",
                    host_country="Germany",
                    ielts_required=tier > 0,
                    ielts_band=f"{tier * 2 + 4}+" if tier else None,
                    ielts_tier=tier,
                    fields_list=["Engineering & Technology"],
                    docs_list=[],
                    deadline_kind="unspecified",
                    selection_ratio_percent=10 - tier,
                    is_active=True,
                    search_text=f"award {tier}",
                    source_data={
                        "total_funding_score": "4",
                        "IELTS_band_recommendation": f"{tier * 2 + 4}+" if tier else "",
                    },
                )
            )
        session.commit()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_onboarding_profile_persists_and_match_uses_it(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "match@example.com", "password": "test-password-123", "full_name": "Match Student"},
    )
    saved = client.put(
        "/api/onboarding/step",
        json={
            "origin_country": "Pakistan",
            "target_level": "Master",
            "host_countries": ["Germany"],
            "fields_of_study": ["Engineering & Technology"],
            "ielts_status": "taking_7",
            "gpa_scale": "4.0",
            "gpa_value": 3.4,
            "funding_preference": "with_stipend",
            "onboarding_step": 7,
        },
    )
    assert saved.status_code == 200
    assert client.get("/api/onboarding").json()["profile"]["gpa_4_equivalent"] == 3.4

    response = client.post("/api/scholarships/match", json={"page": 1, "page_size": 2})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 3
    assert len(payload["items"]) == 2
    assert {item["ielts_tier"] for item in payload["items"]} <= {0, 1, 2}
    assert payload["facets"]["host_country"] == {"Germany": 3}


def test_gpa_convert_tool_returns_percentage_and_equivalent(client: TestClient) -> None:
    response = client.post("/api/tools/gpa-convert", json={"scale": "percentage", "value": 82})
    assert response.status_code == 200
    assert response.json() == {"percentage": 82.0, "gpa_4_equivalent": 3.82}


def test_gpa_convert_rejects_values_outside_selected_scale(client: TestClient) -> None:
    response = client.post("/api/tools/gpa-convert", json={"scale": "4.0", "value": 4.2})
    assert response.status_code == 422


def test_public_catalog_filter_and_detail_search_fallback(client: TestClient) -> None:
    listing = client.get("/api/scholarships", params={"q": "award 2", "country": "Germany", "page_size": 5})
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["scholarship_id"] == "M-2"

    detail = client.get("/api/scholarships/M-2")
    assert detail.status_code == 200
    assert detail.json()["application_url_is_search_fallback"] is True
    assert "google.com/search" in detail.json()["application_url"]
    assert detail.json()["IELTS_band_recommendation"] == "8+"


def test_public_catalog_similar_and_compare(client: TestClient) -> None:
    similar = client.get("/api/scholarships/M-1/similar")
    assert similar.status_code == 200
    assert len(similar.json()) == 3

    compared = client.post("/api/scholarships/compare", json={"ids": ["M-1", "M-3"]})
    assert compared.status_code == 200
    assert {item["scholarship_id"] for item in compared.json()} == {"M-1", "M-3"}
