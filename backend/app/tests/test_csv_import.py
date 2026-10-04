import csv

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Scholarship, UniversityCountry
from app.services.csv_import import (
    clean_source_row,
    derive_ielts_tier,
    import_country_map,
    import_csv,
    parse_bool,
    parse_deadline,
    parse_list,
    pretty_document_name,
)


def test_boolean_cleaning_keeps_explanatory_note() -> None:
    assert parse_bool("N (officially not allowed for scholars)") == (False, "officially not allowed for scholars")
    assert parse_bool("university_dependent") == (None, "university_dependent")
    assert parse_bool("Y") == (True, None)


def test_list_and_document_cleaning() -> None:
    assert parse_list("['Engineering', 'General']") == ["Engineering", "General"]
    assert parse_list("not a python list") == []
    assert pretty_document_name("tworecommendationletters") == "Two Recommendation Letters"


def test_ielts_uses_non_cleaned_band() -> None:
    assert derive_ielts_tier({"IELTS_required": "True", "IELTS_band_recommendation": "8+"}) == (3, None)
    assert derive_ielts_tier({"IELTS_required": "False", "IELTS_band_recommendation": "7+"}) == (0, None)
    tier, warning = derive_ielts_tier({"IELTS_required": "True", "IELTS_band_recommendation": ""})
    assert tier == 2
    assert warning


def test_deadline_variants() -> None:
    assert parse_deadline({"deadline_cleaned": "2027-03-19", "deadline": "19 Mar 2027"})[1] == "fixed"
    assert parse_deadline({"deadline": "Anytime"}) == (None, "anytime")
    assert parse_deadline({"deadline": "Not specified", "rolling_admission": "Y"}) == (None, "unspecified")
    assert parse_deadline({"deadline": "", "rolling_admission": "True"}) == (None, "rolling")


def test_clean_row_preserves_source_and_derives_ratio() -> None:
    source = {
        "scholarship_id": "1",
        "title": "Engineering Award",
        "university_name": "Example University",
        "IELTS_required": "True",
        "IELTS_band_recommendation": "7+",
        "pakistan_applicants_estimate": "30",
        "pakistan_selected_estimate": "1",
        "intelligent_fields_of_study": "['Engineering & Technology']",
        "documents_list": "['tworecommendationletters']",
        "short_description": "<p>Funding <script>alert(1)</script></p>",
    }

    cleaned = clean_source_row(source, {"Example University": "Germany"})

    assert cleaned["host_country"] == "Germany"
    assert cleaned["ielts_tier"] == 2
    assert cleaned["selection_ratio_percent"] == 3.33
    assert cleaned["docs_list"] == ["Two Recommendation Letters"]
    assert "<script" not in cleaned["description_html"].lower()
    assert "</script>" not in cleaned["description_html"].lower()
    assert cleaned["source_data"]["title"] == "Engineering Award"


def test_import_is_idempotent_and_preserves_admin_url(tmp_path) -> None:
    csv_path = tmp_path / "scholarships.csv"
    country_path = tmp_path / "countries.csv"
    fields = ["scholarship_id", "title", "university_name", "IELTS_required", "IELTS_band_recommendation"]
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(
            {
                "scholarship_id": "S-1",
                "title": "Test award",
                "university_name": "Test University",
                "IELTS_required": "Y",
                "IELTS_band_recommendation": "6+",
            }
        )
    country_path.write_text("university_name,host_country,confidence\nTest University,Canada,1.0\n", encoding="utf-8")
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        first = import_csv(session, csv_path, country_path)
        session.get(Scholarship, "S-1").application_url = "https://example.org/apply"
        session.commit()
        second = import_csv(session, csv_path, country_path)

        assert first["inserted"] == 1
        assert second["inserted"] == 0
        assert second["updated"] == 1
        assert session.get(Scholarship, "S-1").application_url == "https://example.org/apply"
        map_first = import_country_map(session, country_path)
        map_second = import_country_map(session, country_path)
        assert map_first["inserted"] == 1
        assert map_second["updated"] == 1
        assert session.get(UniversityCountry, "Test University").host_country == "Canada"
        session.get(UniversityCountry, "Test University").host_country = "France"
        session.commit()
        import_country_map(session, country_path)
        third = import_csv(session, csv_path, country_path)
        assert third["updated"] == 1
        assert session.get(Scholarship, "S-1").host_country == "France"
