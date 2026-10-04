from datetime import date
from types import SimpleNamespace

from app.services.matching import GENERAL_FIELD, final_tier_cap, match_scholarships, profile_g4


def profile(**updates):
    values = {
        "target_level": "Master",
        "ielts_status": "taking_8",
        "gpa_scale": "4.0",
        "gpa_value": 3.9,
        "gpa_4_equivalent": None,
        "bs_marks_obtained": None,
        "bs_marks_total": None,
        "host_countries": [],
        "fields_of_study": [],
        "origin_country": "Pakistan",
        "funding_preference": "any",
    }
    values.update(updates)
    return values


def catalog(level="Master"):
    return [
        SimpleNamespace(
            scholarship_id=str(tier),
            level=level,
            host_country=country,
            ielts_tier=tier,
            fields_list=fields,
            is_active=True,
            selection_ratio_percent=10 - tier,
            deadline_date=date(2027, 1, 1),
            scholarship_type="Fully Funded",
            source_data={"total_funding_score": 5},
        )
        for tier in range(4)
        for country, fields in [("Germany", ["Engineering & Technology"]), ("Canada", [GENERAL_FIELD])]
    ]


def test_not_taking_ielts_only_matches_tier_zero_regardless_of_gpa():
    matched = match_scholarships(catalog(), profile(ielts_status="not_taking", gpa_value=1.0))
    assert {item.ielts_tier for item in matched} == {0}


def test_taking_six_with_high_gpa_matches_tiers_zero_and_one():
    matched = match_scholarships(catalog(), profile(ielts_status="taking_6", gpa_value=3.9))
    assert {item.ielts_tier for item in matched} == {0, 1}


def test_taking_eight_with_high_gpa_matches_all_tiers():
    matched = match_scholarships(catalog(), profile(ielts_status="taking_8", gpa_value=3.9))
    assert {item.ielts_tier for item in matched} == {0, 1, 2, 3}


def test_master_gpa_3_1_caps_at_tier_one():
    assert final_tier_cap(profile(gpa_value=3.1)) == 1


def test_master_gpa_3_4_caps_at_tier_two():
    assert final_tier_cap(profile(gpa_value=3.4)) == 2


def test_undergraduate_marks_80_percent_unlocks_tier_three():
    student = profile(
        target_level="Undergraduate", bs_marks_obtained=800, bs_marks_total=1000, gpa_4_equivalent=None, gpa_value=None
    )
    assert profile_g4(student) == 3.7
    assert final_tier_cap(student) == 3


def test_origin_country_does_not_change_matching():
    items = catalog()
    first = match_scholarships(items, profile(origin_country="Pakistan"))
    second = match_scholarships(items, profile(origin_country="India"))
    assert [item.scholarship_id for item in first] == [item.scholarship_id for item in second]


def test_funding_preference_does_not_change_matching():
    items = catalog()
    first = match_scholarships(items, profile(funding_preference="full_tuition"))
    second = match_scholarships(items, profile(funding_preference="partial"))
    assert [item.scholarship_id for item in first] == [item.scholarship_id for item in second]


def test_empty_host_country_list_matches_every_destination():
    matched = match_scholarships(catalog(), profile(host_countries=[]))
    assert {item.host_country for item in matched} == {"Germany", "Canada"}


def test_specific_field_also_matches_general_field_rows():
    matched = match_scholarships(catalog(), profile(fields_of_study=["Engineering & Technology"]))
    assert any(item.fields_list == [GENERAL_FIELD] for item in matched)
