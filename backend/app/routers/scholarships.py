from datetime import date
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import Profile, Scholarship, User
from app.schemas.profile import MatchRequest, ProfileUpdate
from app.services.entitlements import is_pro
from app.services.matching import final_tier_cap, match_scholarships, result_facets
from app.services.settings import free_result_limit, pro_result_limit

router = APIRouter(prefix="/api/scholarships", tags=["scholarships"])


class CompareRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=3)


def _match_profile(db: Session, user: User, overrides: ProfileUpdate | None) -> dict:
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    values = {
        "origin_country": profile.origin_country if profile else None,
        "target_level": profile.target_level if profile else None,
        "host_countries": profile.host_countries if profile else [],
        "fields_of_study": profile.fields_of_study if profile else [],
        "ielts_status": profile.ielts_status if profile else None,
        "gpa_scale": profile.gpa_scale if profile else None,
        "gpa_value": profile.gpa_value if profile else None,
        "gpa_4_equivalent": profile.gpa_4_equivalent if profile else None,
        "bs_marks_obtained": profile.bs_marks_obtained if profile else None,
        "bs_marks_total": profile.bs_marks_total if profile else None,
        "funding_preference": profile.funding_preference if profile else None,
        "extra_preferences": profile.extra_preferences if profile else {},
    }
    if overrides:
        values.update(overrides.model_dump(exclude_unset=True))
    return values


def _public_scholarship(item: Scholarship) -> dict:
    source = item.source_data or {}
    return {
        "scholarship_id": item.scholarship_id,
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "level": item.level,
        "scholarship_type": item.scholarship_type,
        "ielts_tier": item.ielts_tier,
        "fields_list": item.fields_list,
        "deadline_date": item.deadline_date.isoformat() if item.deadline_date else None,
        "deadline_kind": item.deadline_kind,
        "selection_ratio_percent": item.selection_ratio_percent,
        "grant_amount_formatted": source.get("grant_amount_formatted"),
        "tuition_covered": source.get("tuition_covered"),
        "stipend_monthly_amount": source.get("stipend_monthly_amount"),
        "stipend_monthly_usd": source.get("stipend_monthly_usd"),
        "description_text": item.description_text,
        "chance_label": "Good chance"
        if (item.selection_ratio_percent or 0) >= 10
        else "Moderate"
        if (item.selection_ratio_percent or 0) >= 4
        else "Competitive",
    }


def _filter_matches(items: list[Scholarship], payload: MatchRequest) -> list[Scholarship]:
    filtered = items
    if payload.q:
        needle = payload.q.strip().lower()
        filtered = [
            item
            for item in filtered
            if needle
            in " ".join(
                [
                    str(item.title or ""),
                    str(item.university_name or ""),
                    str(item.host_country or ""),
                    " ".join(str(part) for part in (item.fields_list or [])),
                ]
            ).lower()
        ]
    if payload.country:
        countries = set(payload.country)
        filtered = [item for item in filtered if item.host_country in countries]
    if payload.field:
        fields = set(payload.field)
        filtered = [
            item for item in filtered if not fields.isdisjoint(item.fields_list or [])
        ]
    if payload.award_type:
        filtered = [
            item for item in filtered if item.scholarship_type == payload.award_type
        ]
    if payload.ielts_tier is not None:
        filtered = [
            item
            for item in filtered
            if int(item.ielts_tier or 0) <= payload.ielts_tier
        ]
    return filtered


def _funding_score(item: Scholarship) -> float:
    value = (item.source_data or {}).get("total_funding_score") or 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def _sort_matches(items: list[Scholarship], sort: str) -> list[Scholarship]:
    if sort == "deadline":
        return sorted(items, key=lambda item: (item.deadline_date or date.max))
    if sort == "funding":
        return sorted(items, key=lambda item: -_funding_score(item))
    if sort == "newest":
        return sorted(
            items,
            key=lambda item: str(
                (item.source_data or {}).get("scraped_at")
                or (item.source_data or {}).get("created_at")
                or item.scholarship_id
            ),
            reverse=True,
        )
    return sorted(
        items,
        key=lambda item: -(
            item.selection_ratio_percent
            if item.selection_ratio_percent is not None
            else -1
        ),
    )


@router.get("")
def browse(
    q: str | None = None,
    level: str | None = None,
    country: list[str] | None = Query(default=None),
    field: list[str] | None = Query(default=None),
    ielts_tier: int | None = Query(default=None, ge=0, le=3),
    type: str | None = None,
    deadline_before: date | None = None,
    sort: str = "best_chance",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Scholarship).where(Scholarship.is_active.is_(True))
    if level:
        query = query.where(Scholarship.level == level)
    if country:
        query = query.where(Scholarship.host_country.in_(country))
    if ielts_tier is not None:
        query = query.where(Scholarship.ielts_tier == ielts_tier)
    if type:
        query = query.where(Scholarship.scholarship_type == type)
    if deadline_before:
        query = query.where(Scholarship.deadline_date <= deadline_before)
    if q:
        query = query.where(Scholarship.search_text.contains(q.strip().lower()))
    sql_sorts = {
        "best_chance": case(
            (Scholarship.selection_ratio_percent.is_(None), -1), else_=Scholarship.selection_ratio_percent
        ).desc(),
        "deadline": func.coalesce(Scholarship.deadline_date, date.max).asc(),
    }
    if sort not in {"best_chance", "deadline", "funding", "stipend", "newest"}:
        raise HTTPException(
            status_code=422, detail="Unsupported scholarship sort", headers={"X-Error-Code": "INVALID_SORT"}
        )
    if sort in sql_sorts and not field:
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = db.scalars(
            query.order_by(sql_sorts[sort]).offset((page - 1) * page_size).limit(page_size)
        ).all()
        return {
            "items": [_public_scholarship(item) for item in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    items = list(db.scalars(query).all())
    if field:
        desired = set(field) | {"General / Any Field of Study"}
        items = [item for item in items if not set(item.fields_list or []).isdisjoint(desired)]
    sorters = {
        "best_chance": lambda item: -(item.selection_ratio_percent if item.selection_ratio_percent is not None else -1),
        "deadline": lambda item: item.deadline_date or date.max,
        "funding": lambda item: -float((item.source_data or {}).get("total_funding_score") or 0),
        "stipend": lambda item: -float((item.source_data or {}).get("stipend_monthly_usd") or 0),
        "newest": lambda item: -(int(item.scholarship_id) if item.scholarship_id.isdigit() else 0),
    }
    items.sort(key=sorters[sort])
    total = len(items)
    start = (page - 1) * page_size
    return {
        "items": [_public_scholarship(item) for item in items[start : start + page_size]],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{scholarship_id}")
def detail(scholarship_id: str, db: Session = Depends(get_db)) -> dict:
    item = db.get(Scholarship, scholarship_id)
    if item is None or not item.is_active:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    result = dict(item.source_data or {})
    result.update(_public_scholarship(item))
    query = f"{item.title} {item.university_name or ''} scholarship apply"
    result["application_url"] = item.application_url or f"https://www.google.com/search?q={quote_plus(query)}"
    result["application_url_is_search_fallback"] = item.application_url is None
    return result


@router.get("/{scholarship_id}/similar")
def similar(scholarship_id: str, db: Session = Depends(get_db)) -> list[dict]:
    source = db.get(Scholarship, scholarship_id)
    if source is None:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    fields = source.fields_list or []
    candidates = db.scalars(
        select(Scholarship).where(
            Scholarship.is_active.is_(True),
            Scholarship.level == source.level,
            Scholarship.scholarship_id != source.scholarship_id,
        )
    ).all()
    similar_items = [item for item in candidates if not set(fields).isdisjoint(item.fields_list or [])]
    similar_items.sort(key=lambda item: item.host_country != source.host_country)
    return [_public_scholarship(item) for item in similar_items[:8]]


@router.post("/compare")
def compare(payload: CompareRequest, db: Session = Depends(get_db)) -> list[dict]:
    unique_ids = list(dict.fromkeys(payload.ids))
    items = db.scalars(
        select(Scholarship).where(Scholarship.scholarship_id.in_(unique_ids), Scholarship.is_active.is_(True))
    ).all()
    by_id = {item.scholarship_id: item for item in items}
    return [_public_scholarship(by_id[item_id]) for item_id in unique_ids if item_id in by_id]


@router.post("/match")
def match(payload: MatchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    profile = _match_profile(db, user, payload.profile)
    if not profile["target_level"] or not profile["ielts_status"]:
        return {
            "items": [],
            "total": 0,
            "page": payload.page,
            "page_size": payload.page_size,
            "facets": {},
            "message": "Complete your study level and IELTS preference to see matches.",
        }
    candidates = db.scalars(select(Scholarship).where(Scholarship.is_active.is_(True))).all()
    matches = match_scholarships(list(candidates), profile)
    facets = result_facets(matches)
    matches = _filter_matches(matches, payload)
    matches = _sort_matches(matches, payload.sort)
    total = len(matches)
    limit = pro_result_limit(db) if is_pro(user) else free_result_limit(db)
    start = (payload.page - 1) * payload.page_size
    page_items = matches[start : min(start + payload.page_size, limit)] if start < limit else []
    response = {
        "items": [_public_scholarship(item) for item in page_items],
        "total": min(total, limit),
        "page": payload.page,
        "page_size": payload.page_size,
        "facets": facets,
        "gpa_missing": profile["gpa_4_equivalent"] is None and profile["gpa_value"] is None,
        "final_tier_cap": final_tier_cap(profile),
    }
    if total == 0:
        response["message"] = (
            "No scholarships match this profile yet. Try widening your country/field choices "
            "or updating your IELTS and GPA details."
            if not facets
            else "No scholarships match the current filters. Clear the filters to see all eligible results."
        )
    return response
