import ast
import csv
import re
import time
from datetime import date
from pathlib import Path
from typing import Any

import bleach
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Scholarship, UniversityCountry

LIST_FIELDS = {
    "disciplines",
    "disciplines_processed",
    "intelligent_fields_of_study",
    "documents_list",
}
BOOL_FIELDS = {
    "rolling_admission",
    "health_insurance_covered",
    "work_allowed_during_study",
    "final_year_students_can_apply",
    "account_required",
    "attestation_required",
    "medical_certificate_required",
    "police_clearance_required",
    "language_course_included",
}
DOC_NAMES = {
    "AcademicTranscripts": "Academic Transcripts",
    "tworecommendationletters": "Two Recommendation Letters",
    "onlineapplicationform": "Online Application Form",
    "recommendationletters": "Recommendation Letters",
    "passportcopy": "Passport Copy",
    "researchproposal": "Research Proposal",
}
ALLOWED_DESCRIPTION_TAGS = ["p", "br", "ul", "ol", "li", "b", "strong", "i", "em", "a"]


def parse_bool(value: str | None) -> tuple[bool | None, str | None]:
    text = (value or "").strip()
    lowered = text.lower()
    note_match = re.search(r"\((.*?)\)", text)
    note = note_match.group(1).strip() if note_match else None
    if lowered in {"true", "y"} or lowered.startswith(("true ", "y ")):
        return True, note
    if lowered in {"false", "n"} or lowered.startswith(("false ", "n ")):
        return False, note
    if not lowered or lowered in {"none", "nan", "null"}:
        return None, note
    return None, note or text


def parse_list(value: str | None) -> list[str]:
    text = (value or "").strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
    except (SyntaxError, ValueError):
        return []
    if isinstance(parsed, (list, tuple, set)):
        return [str(item).strip() for item in parsed if str(item).strip()]
    return []


def pretty_document_name(value: str) -> str:
    if value in DOC_NAMES:
        return DOC_NAMES[value]
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", value)
    return re.sub(r"[_-]+", " ", spaced).strip().title()


def parse_deadline(row: dict[str, str]) -> tuple[date | None, str]:
    cleaned = (row.get("deadline_cleaned") or "").strip()
    original = (row.get("deadline") or "").strip()
    if cleaned:
        try:
            return date.fromisoformat(cleaned[:10]), "fixed"
        except ValueError:
            pass
    if original.lower() == "anytime":
        return None, "anytime"
    if original.lower() in {"not specified", "unspecified"}:
        return None, "unspecified"
    for fmt in ("%d %b %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            parsed = time.strptime(original, fmt)
            return date(parsed.tm_year, parsed.tm_mon, parsed.tm_mday), "fixed"
        except ValueError:
            continue
    rolling, _ = parse_bool(row.get("rolling_admission"))
    if rolling:
        return None, "rolling"
    return None, "unspecified"


def derive_ielts_tier(row: dict[str, str]) -> tuple[int, str | None]:
    required, _ = parse_bool(row.get("IELTS_required"))
    if required is False:
        return 0, None
    band = (row.get("IELTS_band_recommendation") or "").strip()
    tier = {"6+": 1, "7+": 2, "8+": 3}.get(band)
    if tier is not None:
        return tier, None
    return (2, "IELTS required but band missing; defaulted to tier 2") if required else (0, None)


def clean_source_row(row: dict[str, str], country_map: dict[str, str]) -> dict[str, Any]:
    raw = {key: (value or "").strip() for key, value in row.items() if key}
    fields = parse_list(raw.get("intelligent_fields_of_study"))
    docs = [pretty_document_name(item) for item in parse_list(raw.get("documents_list"))]
    deadline_date, deadline_kind = parse_deadline(raw)
    ielts_tier, _ = derive_ielts_tier(raw)
    applicants = _number(raw.get("pakistan_applicants_estimate"))
    selected = _number(raw.get("pakistan_selected_estimate"))
    ratio = round(selected / applicants * 100, 2) if applicants and selected is not None else None
    description_html = bleach.clean(
        raw.get("short_description", ""), tags=ALLOWED_DESCRIPTION_TAGS, attributes={"a": ["href", "title"]}, strip=True
    )
    description_text = bleach.clean(description_html, tags=[], strip=True)
    university = raw.get("university_name", "")
    searchable = " ".join(
        (
            raw.get("title", ""),
            university,
            description_text,
            " ".join(fields),
        )
    ).lower()
    return {
        "scholarship_id": raw.get("scholarship_id", "").strip(),
        "level": raw.get("level") or None,
        "title": raw.get("title") or "Untitled scholarship",
        "university_name": university or None,
        "scholarship_type": raw.get("scholarship_type") or None,
        "host_country": country_map.get(university, "Unknown"),
        "ielts_required": parse_bool(raw.get("IELTS_required"))[0],
        "ielts_band": raw.get("IELTS_band_recommendation") or None,
        "ielts_tier": ielts_tier,
        "fields_list": fields,
        "docs_list": docs,
        "deadline_date": deadline_date,
        "deadline_kind": deadline_kind,
        "selection_ratio_percent": ratio,
        "application_url": None,
        "is_active": True,
        "description_html": description_html or None,
        "description_text": description_text or None,
        "search_text": searchable,
        "source_data": raw,
    }


def _number(value: str | None) -> float | None:
    try:
        return float(value) if value and value.strip() else None
    except ValueError:
        return None


def read_country_map(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return {row["university_name"]: row["host_country"] for row in csv.DictReader(handle)}


def import_country_map(session: Session, path: Path) -> dict[str, int]:
    report = {"inserted": 0, "updated": 0}
    if not path.exists():
        return report
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            name = row["university_name"].strip()
            if not name:
                continue
            country = session.get(UniversityCountry, name)
            values = {
                "host_country": row.get("host_country", "Unknown").strip() or "Unknown",
                "confidence": _number(row.get("confidence")) or 0.0,
            }
            if country is None:
                session.add(UniversityCountry(university_name=name, **values))
                report["inserted"] += 1
            else:
                report["updated"] += 1
    session.commit()
    return report


def import_csv(
    session: Session,
    file_path: Path,
    country_map_path: Path,
    chunk_size: int = 500,
    dry_run: bool = False,
) -> dict[str, Any]:
    countries = read_country_map(country_map_path)
    for mapping in session.scalars(select(UniversityCountry)).all():
        countries[mapping.university_name] = mapping.host_country
    report: dict[str, Any] = {
        "rows_read": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "unknown_country": 0,
        "warnings": 0,
        "errors": [],
        "preview": [],
        "would_insert": 0,
        "would_update": 0,
        "dry_run": dry_run,
    }
    seen_ids: set[str] = set()
    with file_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            report["errors"].append("CSV has no header row")
            return report
        for row in reader:
            report["rows_read"] += 1
            try:
                cleaned = clean_source_row(row, countries)
            except Exception as exc:  # noqa: BLE001 - surface row-level problems to the admin
                report["errors"].append(f"row {report['rows_read']}: {exc}")
                continue
            if not cleaned["scholarship_id"]:
                report["skipped"] += 1
                report["errors"].append(f"row {report['rows_read']}: missing scholarship_id")
                continue
            if cleaned["scholarship_id"] in seen_ids:
                report["skipped"] += 1
                report["errors"].append(
                    f"row {report['rows_read']}: duplicate scholarship_id {cleaned['scholarship_id']}"
                )
                continue
            seen_ids.add(cleaned["scholarship_id"])
            if cleaned["host_country"] == "Unknown":
                report["unknown_country"] += 1
            if row.get("IELTS_required", "").strip().lower() in {"true", "y"} and not cleaned["ielts_band"]:
                report["warnings"] += 1
            if len(report["preview"]) < 20:
                report["preview"].append(
                    {
                        key: cleaned[key]
                        for key in (
                            "scholarship_id",
                            "title",
                            "university_name",
                            "host_country",
                            "level",
                            "scholarship_type",
                            "ielts_required",
                            "ielts_band",
                            "deadline_date",
                            "is_active",
                        )
                        if key in cleaned
                    }
                )
            existing = session.get(Scholarship, cleaned["scholarship_id"])
            if existing is None:
                if dry_run:
                    report["would_insert"] += 1
                    report["inserted"] += 1
                else:
                    session.add(Scholarship(**cleaned))
                    report["inserted"] += 1
            else:
                if dry_run:
                    report["would_update"] += 1
                    report["updated"] += 1
                else:
                    for key, value in cleaned.items():
                        if key != "application_url" or value is not None:
                            setattr(existing, key, value)
                    report["updated"] += 1
            if not dry_run and report["rows_read"] % chunk_size == 0:
                session.commit()
    if dry_run:
        session.rollback()
    else:
        session.commit()
    return report
