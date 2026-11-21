from collections import Counter
from datetime import date
from typing import Any

from app.core.config import GPA_THRESHOLDS, SEVEN_PLUS_SEES_ALL
from app.services.gpa import bs_marks_to_g4, to_g4

IELTS_CAPS = {"not_taking": 0, "taking_6": 1, "taking_7": 2, "taking_8": 3}
LEVEL_ALIASES = {
    "bachelor": "Undergraduate",
    "bachelors": "Undergraduate",
    "bachelor's": "Undergraduate",
    "bachelor's (undergraduate)": "Undergraduate",
    "undergrad": "Undergraduate",
    "undergraduate": "Undergraduate",
    "bs": "Undergraduate",
    "b.s": "Undergraduate",
    "master": "Master",
    "masters": "Master",
    "master's": "Master",
    "ms": "Master",
    "m.s": "Master",
    "msc": "Master",
    "m.sc": "Master",
    "phd": "PhD",
    "doctorate": "PhD",
}
GENERAL_FIELD = "General / Any Field of Study"


def canonical_level(level: str | None) -> str | None:
    if level is None:
        return None
    normalized = " ".join(level.strip().lower().replace("’", "'").split())
    canonical = LEVEL_ALIASES.get(normalized)
    return canonical if canonical is not None else level.strip()


def profile_g4(profile: Any) -> float | None:
    value = _get(profile, "gpa_4_equivalent")
    if value is not None:
        return float(value)
    obtained = _get(profile, "bs_marks_obtained")
    total = _get(profile, "bs_marks_total")
    if obtained is not None and total:
        return bs_marks_to_g4(float(obtained), float(total))
    value = _get(profile, "gpa_value")
    scale = _get(profile, "gpa_scale")
    if value is None or scale is None:
        return None
    return to_g4(str(scale), float(value))


def gpa_cap(profile: Any) -> int:
    g4 = profile_g4(profile)
    if g4 is None:
        return 3
    level = canonical_level(_get(profile, "target_level"))
    threshold_1, threshold_2 = GPA_THRESHOLDS.get(level or "", (3.2, 3.6))
    if g4 < threshold_1:
        return 1
    if g4 < threshold_2:
        return 2
    return 3


def final_tier_cap(profile: Any) -> int:
    status = _get(profile, "ielts_status")
    ielts_cap = IELTS_CAPS.get(status, 3)
    if status == "taking_7" and SEVEN_PLUS_SEES_ALL:
        ielts_cap = 3
    if status == "not_taking":
        return 0
    return min(ielts_cap, gpa_cap(profile))


def match_scholarships(scholarships: list[Any], profile: Any) -> list[Any]:
    target_level = canonical_level(_get(profile, "target_level"))
    countries = set(_get(profile, "host_countries", []) or [])
    fields = set(_get(profile, "fields_of_study", []) or [])
    wanted = fields | ({GENERAL_FIELD} if fields else set())
    cap = final_tier_cap(profile)

    eligible = []
    for scholarship in scholarships:
        if not _get(scholarship, "is_active", True):
            continue
        if canonical_level(_get(scholarship, "level")) != target_level:
            continue
        if int(_get(scholarship, "ielts_tier", 0) or 0) > cap:
            continue
        country = _get(scholarship, "host_country", "Unknown")
        if countries and country not in countries:
            continue
        scholarship_fields = set(_get(scholarship, "fields_list", []) or [])
        if wanted and scholarship_fields.isdisjoint(wanted):
            continue
        eligible.append(scholarship)
    return sorted(
        eligible,
        key=lambda item: (
            -float(_get(item, "selection_ratio_percent") if _get(item, "selection_ratio_percent") is not None else -1),
            _get(item, "deadline_date") or date.max,
            -float((_get(item, "source_data", {}) or {}).get("total_funding_score") or 0),
        ),
    )


def result_facets(scholarships: list[Any]) -> dict[str, dict[str, int]]:
    facets: dict[str, Counter] = {
        "host_country": Counter(),
        "field": Counter(),
        "ielts_tier": Counter(),
        "scholarship_type": Counter(),
    }
    for scholarship in scholarships:
        facets["host_country"][_get(scholarship, "host_country", "Unknown")] += 1
        facets["ielts_tier"][str(_get(scholarship, "ielts_tier", 0))] += 1
        facets["scholarship_type"][_get(scholarship, "scholarship_type", "Unknown")] += 1
        facets["field"].update(_get(scholarship, "fields_list", []) or [])
    return {name: dict(counter) for name, counter in facets.items()}


def _get(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)
