import os
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import Application, SavedScholarship, Scholarship, UniversityCountry, User
from app.services.csv_import import import_country_map, import_csv

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Admin account required", headers={"X-Error-Code": "AUTH_ADMIN_REQUIRED"}
        )
    return user


class ScholarshipPatch(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    host_country: str | None = Field(default=None, max_length=120)
    application_url: str | None = None
    is_active: bool | None = None
    source_data: dict[str, Any] | None = None


class CountryPatch(BaseModel):
    host_country: str = Field(min_length=1, max_length=120)
    confidence: float = Field(default=1.0, ge=0, le=1)


class AdminUserPatch(BaseModel):
    is_active: bool | None = None
    plan: str | None = Field(default=None, pattern="^(free|pro)$")


@router.get("/stats")
def stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> dict:
    return {
        "users": db.scalar(select(func.count(User.id))) or 0,
        "new_today": 0,
        "pro_users": db.scalar(select(func.count(User.id)).where(User.plan == "pro")) or 0,
        "scholarships": db.scalar(select(func.count(Scholarship.scholarship_id))) or 0,
        "saved": db.scalar(select(func.count()).select_from(SavedScholarship)) or 0,
        "applications": db.scalar(select(func.count(Application.id))) or 0,
    }


@router.get("/scholarships")
def list_scholarships(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query = select(Scholarship)
    if q:
        query = query.where(Scholarship.search_text.contains(q.lower()))
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_admin_scholarship(item) for item in items], "page": page, "page_size": page_size}


@router.patch("/scholarships/{scholarship_id}")
def update_scholarship(
    scholarship_id: str, payload: ScholarshipPatch, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> dict:
    item = db.get(Scholarship, scholarship_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    changes = payload.model_dump(exclude_unset=True)
    for key in ("title", "host_country", "application_url", "is_active"):
        if key in changes:
            setattr(item, key, changes.pop(key))
    if "source_data" in changes:
        item.source_data = {**(item.source_data or {}), **changes["source_data"]}
    if "title" in payload.model_fields_set:
        item.search_text = " ".join((item.title, item.university_name or "", item.description_text or "")).lower()
    db.commit()
    db.refresh(item)
    return _admin_scholarship(item)


@router.post("/scholarships/import-csv")
async def import_scholarships(
    file: UploadFile = File(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Upload a CSV file", headers={"X-Error-Code": "CSV_REQUIRED"})
    content = await file.read(25 * 1024 * 1024 + 1)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="CSV exceeds the 25 MB upload limit", headers={"X-Error-Code": "CSV_TOO_LARGE"}
        )
    default_data_dir = Path(__file__).resolve().parents[3] / "data"
    map_path = Path(os.getenv("DATA_DIR", str(default_data_dir))) / "university_country_map.csv"
    with TemporaryDirectory() as directory:
        csv_path = Path(directory) / "upload.csv"
        csv_path.write_bytes(content)
        map_report = import_country_map(db, map_path)
        report = import_csv(db, csv_path, map_path)
    return {"country_map": map_report, "import": report}


@router.get("/universities/unmapped")
def unmapped_universities(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> list[dict]:
    return [
        {"university_name": item.university_name, "host_country": item.host_country, "confidence": item.confidence}
        for item in db.scalars(
            select(UniversityCountry)
            .where(UniversityCountry.confidence < 0.8)
            .order_by(UniversityCountry.university_name)
            .limit(500)
        ).all()
    ]


@router.patch("/universities/{university_name}/country")
def update_university_country(
    university_name: str, payload: CountryPatch, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> dict:
    item = db.get(UniversityCountry, university_name)
    if item:
        item.host_country = payload.host_country
        item.confidence = payload.confidence
    else:
        item = UniversityCountry(
            university_name=university_name, host_country=payload.host_country, confidence=payload.confidence
        )
        db.add(item)
    db.execute(
        Scholarship.__table__.update()
        .where(Scholarship.university_name == university_name)
        .values(host_country=payload.host_country)
    )
    db.commit()
    return {"university_name": university_name, "host_country": payload.host_country, "confidence": payload.confidence}


@router.get("/users")
def list_users(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    query = select(User).order_by(User.created_at.desc())
    if q:
        query = query.where(User.email.contains(q.lower()) | User.full_name.contains(q))
    users = db.scalars(query.offset((max(1, page) - 1) * min(page_size, 100)).limit(min(page_size, 100))).all()
    return {
        "items": [
            {
                "id": item.id,
                "email": item.email,
                "full_name": item.full_name,
                "role": item.role,
                "is_active": item.is_active,
                "plan": item.plan,
                "created_at": item.created_at,
            }
            for item in users
        ]
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int, payload: AdminUserPatch, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "plan": user.plan,
    }


def _admin_scholarship(item: Scholarship) -> dict:
    return {
        "scholarship_id": item.scholarship_id,
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "application_url": item.application_url,
        "level": item.level,
        "scholarship_type": item.scholarship_type,
        "is_active": item.is_active,
        "source_data": item.source_data,
    }
