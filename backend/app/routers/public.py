import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.ratelimit import limiter
from app.models import Scholarship
from app.services.email import send_contact_message

router = APIRouter(prefix="/api/public", tags=["public"])

_CACHE_TTL_SECONDS = 120.0
_stats_cache: tuple[float, dict] | None = None
_featured_cache: tuple[float, dict] | None = None


def _featured_card(item: Scholarship) -> dict:
    source = item.source_data or {}
    return {
        "scholarship_id": item.scholarship_id,
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "level": item.level,
        "scholarship_type": item.scholarship_type,
        "ielts_tier": item.ielts_tier,
        "deadline_date": item.deadline_date.isoformat() if item.deadline_date else None,
        "deadline_kind": item.deadline_kind,
        "selection_ratio_percent": item.selection_ratio_percent,
        "grant_amount_formatted": source.get("grant_amount_formatted"),
        "tuition_covered": source.get("tuition_covered"),
    }


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)) -> dict:
    global _stats_cache
    now = time.monotonic()
    if _stats_cache and now - _stats_cache[0] < _CACHE_TTL_SECONDS:
        return _stats_cache[1]

    active = Scholarship.is_active.is_(True)
    scholarship_count = db.scalar(select(func.count()).select_from(Scholarship).where(active)) or 0
    universities = (
        db.scalar(
            select(func.count(func.distinct(Scholarship.university_name))).where(
                active,
                Scholarship.university_name.is_not(None),
                Scholarship.university_name != "",
            )
        )
        or 0
    )
    countries = (
        db.scalar(
            select(func.count(func.distinct(Scholarship.host_country))).where(
                active,
                Scholarship.host_country.is_not(None),
                Scholarship.host_country != "",
                Scholarship.host_country != "Unknown",
            )
        )
        or 0
    )
    payload = {
        "scholarships": scholarship_count,
        "universities": universities,
        "countries": countries,
        "data_label": "Curated scholarship catalogue",
    }
    _stats_cache = (now, payload)
    return payload


@router.get("/featured")
def public_featured(db: Session = Depends(get_db)) -> dict:
    global _featured_cache
    now = time.monotonic()
    if _featured_cache and now - _featured_cache[0] < _CACHE_TTL_SECONDS:
        return _featured_cache[1]

    rows = db.scalars(
        select(Scholarship)
        .where(Scholarship.is_active.is_(True))
        .order_by(Scholarship.selection_ratio_percent.desc().nullslast(), Scholarship.title)
        .limit(3)
    ).all()
    payload = {"items": [_featured_card(item) for item in rows]}
    _featured_cache = (now, payload)
    return payload


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=10, max_length=4000)


@router.post("/contact", status_code=202)
@limiter.limit("5/hour")
def public_contact(request: Request, payload: ContactRequest) -> dict:
    name = payload.name.strip()
    message = payload.message.strip()
    if not name or len(message) < 10:
        raise HTTPException(
            status_code=422,
            detail="Please include your name and a little more detail.",
        )
    send_contact_message(
        name=name,
        email=str(payload.email),
        topic=payload.topic.strip(),
        message=message,
    )
    return {"ok": True}
