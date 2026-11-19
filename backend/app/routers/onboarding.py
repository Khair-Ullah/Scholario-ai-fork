import pycountry
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import Profile, Scholarship, User
from app.schemas.profile import GpaConvertRequest, ProfileUpdate
from app.services.gpa import bs_marks_to_g4, to_g4, to_percentage

router = APIRouter(tags=["onboarding", "meta", "tools"])
FIELDS = [
    "General / Any Field of Study",
    "Social Sciences",
    "Natural Sciences",
    "Business & Economics",
    "Health & Medical Sciences",
    "Engineering & Technology",
    "Arts & Humanities",
]
NON_STUDY_COUNTRY_CODES = {"AQ"}
COUNTRIES = sorted(
    country.name for country in pycountry.countries if country.alpha_2 not in NON_STUDY_COUNTRY_CODES
)


def _get_profile(db: Session, user_id: int) -> Profile:
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if profile is None:
        profile = Profile(user_id=user_id, host_countries=[], fields_of_study=[], extra_preferences={})
        db.add(profile)
        db.flush()
    return profile


@router.get("/api/onboarding")
def get_onboarding(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    return {
        "full_name": user.full_name,
        "profile": jsonable_encoder(profile),
        "onboarding_step": profile.onboarding_step if profile else 1,
        "onboarding_completed": profile.onboarding_completed if profile else False,
    }


@router.put("/api/onboarding/step")
def update_onboarding(
    payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    profile = _get_profile(db, user.id)
    updates = payload.model_dump(exclude_unset=True)
    full_name = updates.pop("full_name", None)
    if full_name is not None:
        user.full_name = full_name.strip()
    for key, value in updates.items():
        setattr(profile, key, value)
    if profile.gpa_value is not None and profile.gpa_scale:
        try:
            profile.gpa_4_equivalent = to_g4(profile.gpa_scale, profile.gpa_value)
        except ValueError:
            profile.gpa_4_equivalent = None
    elif profile.bs_marks_obtained is not None and profile.bs_marks_total:
        try:
            profile.gpa_4_equivalent = bs_marks_to_g4(profile.bs_marks_obtained, profile.bs_marks_total)
        except ValueError:
            profile.gpa_4_equivalent = None
    db.commit()
    db.refresh(profile)
    return {"profile": jsonable_encoder(profile), "onboarding_step": profile.onboarding_step}


@router.post("/api/onboarding/complete")
def complete_onboarding(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    profile = _get_profile(db, user.id)
    if not profile.target_level or not profile.ielts_status:
        raise HTTPException(
            status_code=400,
            detail="Choose a study level and IELTS preference before finishing",
            headers={"X-Error-Code": "ONBOARDING_INCOMPLETE"},
        )
    profile.onboarding_completed = True
    db.commit()
    return {"onboarding_completed": True}


@router.get("/api/meta/host-countries")
def host_countries(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.execute(
        select(Scholarship.host_country, func.count(Scholarship.scholarship_id))
        .where(Scholarship.host_country != "Unknown", Scholarship.is_active.is_(True))
        .group_by(Scholarship.host_country)
        .order_by(Scholarship.host_country)
    ).all()
    return [{"country": country, "count": count} for country, count in rows]


@router.get("/api/meta/fields")
def fields() -> list[str]:
    return FIELDS


@router.get("/api/meta/levels")
def levels() -> list[str]:
    return ["Undergraduate", "Master", "PhD"]


@router.get("/api/meta/countries")
def countries() -> list[str]:
    return COUNTRIES


@router.post("/api/tools/gpa-convert")
def convert_gpa(payload: GpaConvertRequest) -> dict[str, float]:
    try:
        if payload.marks_obtained is not None and payload.marks_total is not None:
            percentage = payload.marks_obtained / payload.marks_total * 100
            g4 = bs_marks_to_g4(payload.marks_obtained, payload.marks_total)
        else:
            percentage = to_percentage(payload.scale, payload.value)
            g4 = to_g4(payload.scale, payload.value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc), headers={"X-Error-Code": "INVALID_GPA"}) from exc
    return {"percentage": round(percentage, 2), "gpa_4_equivalent": g4}
