import csv
import io
import os
from datetime import date, datetime, time, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import (
    Application,
    AuditLog,
    ChatMessage,
    ChatSession,
    Document,
    Notification,
    Profile,
    RefreshToken,
    SavedScholarship,
    Scholarship,
    Template,
    UniversityCountry,
    User,
)
from app.services.audit import log_audit, request_ip
from app.services.csv_import import import_country_map, import_csv
from app.services.settings import get_settings, save_settings

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
    university_name: str | None = Field(default=None, max_length=240)
    application_url: str | None = None
    level: str | None = Field(default=None, max_length=40)
    scholarship_type: str | None = Field(default=None, max_length=80)
    ielts_required: bool | None = None
    ielts_band: str | None = Field(default=None, max_length=20)
    ielts_tier: int | None = Field(default=None, ge=0, le=3)
    deadline_date: date | None = None
    deadline_kind: str | None = Field(default=None, pattern="^(fixed|anytime|unspecified|rolling)$")
    fields_list: list[str] | None = None
    is_active: bool | None = None
    description_text: str | None = None
    source_data: dict[str, Any] | None = None


class CountryPatch(BaseModel):
    host_country: str = Field(min_length=1, max_length=120)
    confidence: float = Field(default=1.0, ge=0, le=1)


class AdminUserPatch(BaseModel):
    is_active: bool | None = None
    plan: str | None = Field(default=None, pattern="^(free|pro)$")
    role: str | None = Field(default=None, pattern="^(student|admin)$")
    is_verified: bool | None = None


class ScholarshipCreate(BaseModel):
    scholarship_id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=500)
    university_name: str | None = Field(default=None, max_length=240)
    host_country: str | None = Field(default=None, max_length=120)
    level: str | None = Field(default=None, max_length=40)
    scholarship_type: str | None = Field(default=None, max_length=80)
    ielts_required: bool | None = None
    ielts_band: str | None = Field(default=None, max_length=20)
    ielts_tier: int | None = Field(default=None, ge=0, le=3)
    deadline_date: date | None = None
    deadline_kind: str | None = Field(default=None, pattern="^(fixed|anytime|unspecified|rolling)$")
    fields_list: list[str] | None = None
    docs_list: list[str] | None = None
    application_url: str | None = None
    is_active: bool | None = True
    description_text: str | None = None
    selection_ratio_percent: float | None = None
    source_data: dict[str, Any] | None = None


class BulkAction(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)
    action: str = Field(pattern="^(activate|deactivate|delete)$")


class TemplateCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=40)
    description: str = ""
    body_html: str = ""
    fields_json: list[dict[str, Any]] = Field(default_factory=list)
    recommended_word_range: list[int] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    is_premium: bool = False
    is_active: bool = True
    sort_order: int = 0


class TemplatePatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = None
    body_html: str | None = None
    fields_json: list[dict[str, Any]] | None = None
    recommended_word_range: list[int] | None = None
    tips: list[str] | None = None
    is_premium: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class TemplateReorder(BaseModel):
    sort_order: int = Field(ge=0, le=10_000)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    audience: str = Field(default="all", pattern="^(all|pro|free)$")
    link: str | None = Field(default=None, max_length=500)


class PaymentGrant(BaseModel):
    user_id: int
    plan: str = Field(pattern="^(free|pro)$")
    expires_at: datetime | None = None
    note: str | None = Field(default=None, max_length=500)


class TransferApproval(BaseModel):
    reference: str = Field(min_length=1, max_length=120)
    user_id: int | None = None
    note: str | None = Field(default=None, max_length=500)
    approve: bool = True


class SettingsPatch(BaseModel):
    ai_provider: str | None = Field(default=None, max_length=40)
    flags: dict[str, bool] | None = None
    limits: dict[str, int] | None = None



@router.get("/stats")
def stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> dict:
    today = date.today()
    start_7d = today - timedelta(days=6)
    new_today = (
        db.scalar(
            select(func.count(User.id)).where(func.date(User.created_at) == today)
        )
        or 0
    )
    new_7d = (
        db.scalar(
            select(func.count(User.id)).where(
                User.created_at >= datetime.combine(start_7d, time(0))
            )
        )
        or 0
    )
    pro_users = db.scalar(select(func.count(User.id)).where(User.plan == "pro")) or 0
    scholarships = db.scalar(select(func.count(Scholarship.scholarship_id))) or 0
    active_scholarships = (
        db.scalar(
            select(func.count(Scholarship.scholarship_id)).where(
                Scholarship.is_active.is_(True)
            )
        )
        or 0
    )
    saved = db.scalar(select(func.count()).select_from(SavedScholarship)) or 0
    applications = db.scalar(select(func.count(Application.id))) or 0
    documents = db.scalar(select(func.count()).select_from(Document)) or 0
    ai_messages_7d = (
        db.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.created_at >= datetime.combine(start_7d, time(0))
            )
        )
        or 0
    )
    signups_by_day_rows = db.execute(
        select(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= datetime.combine(today - timedelta(days=29), time(0)))
        .group_by(func.date(User.created_at))
        .order_by("date")
    ).all()
    signups_by_day = [
        {"date": str(r[0]), "count": r[1]} for r in signups_by_day_rows
    ]
    top_saved_rows = db.execute(
        select(
            SavedScholarship.scholarship_id,
            Scholarship.title,
            func.count(SavedScholarship.user_id).label("saves"),
        )
        .join(Scholarship, Scholarship.scholarship_id == SavedScholarship.scholarship_id)
        .group_by(SavedScholarship.scholarship_id, Scholarship.title)
        .order_by(desc("saves"))
        .limit(10)
    ).all()
    top_saved = [
        {"scholarship_id": r[0], "title": r[1], "saves": r[2]} for r in top_saved_rows
    ]
    latest_users_rows = db.execute(
        select(User.id, User.email, User.full_name, User.created_at)
        .order_by(User.created_at.desc())
        .limit(5)
    ).all()
    latest_users = [
        {
            "id": r[0],
            "email": r[1],
            "full_name": r[2],
            "created_at": r[3],
        }
        for r in latest_users_rows
    ]
    return {
        "users": db.scalar(select(func.count(User.id))) or 0,
        "new_today": new_today,
        "new_7d": new_7d,
        "pro_users": pro_users,
        "scholarships": scholarships,
        "active_scholarships": active_scholarships,
        "saved": saved,
        "applications": applications,
        "documents": documents,
        "ai_messages_7d": ai_messages_7d,
        "signups_by_day": signups_by_day,
        "top_saved": top_saved,
        "latest_users": latest_users,
    }


@router.get("/scholarships")
def list_scholarships(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    level: str | None = None,
    host_country: str | None = None,
    is_active: bool | None = None,
    scholarship_type: str | None = None,
    sort: str | None = None,
    order: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query = select(Scholarship)
    if q:
        query = query.where(Scholarship.search_text.contains(q.lower()))
    if level:
        query = query.where(Scholarship.level == level)
    if host_country:
        query = query.where(Scholarship.host_country == host_country)
    if is_active is not None:
        query = query.where(Scholarship.is_active.is_(is_active))
    if scholarship_type:
        query = query.where(Scholarship.scholarship_type == scholarship_type)

    sort_key = sort or "title"
    direction = desc if (order or "asc").lower() == "desc" else lambda x: x
    if sort_key == "deadline":
        query = query.order_by(direction(Scholarship.deadline_date))
    elif sort_key == "host_country":
        query = query.order_by(direction(Scholarship.host_country))
    elif sort_key == "scholarship_id":
        query = query.order_by(direction(Scholarship.scholarship_id))
    else:
        query = query.order_by(direction(Scholarship.title))

    count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [_admin_scholarship(item) for item in items],
        "total": count,
        "page": page,
        "page_size": page_size,
    }


@router.post("/scholarships")
def create_scholarship(
    payload: ScholarshipCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    if db.get(Scholarship, payload.scholarship_id):
        raise HTTPException(
            status_code=409,
            detail="Scholarship with this ID already exists",
            headers={"X-Error-Code": "SCHOLARSHIP_EXISTS"},
        )
    item = Scholarship(
        scholarship_id=payload.scholarship_id,
        title=payload.title,
        university_name=payload.university_name,
        host_country=payload.host_country,
        level=payload.level,
        scholarship_type=payload.scholarship_type,
        ielts_required=payload.ielts_required,
        ielts_band=payload.ielts_band,
        ielts_tier=payload.ielts_tier,
        deadline_date=payload.deadline_date,
        deadline_kind=payload.deadline_kind or "unspecified",
        fields_list=payload.fields_list or [],
        docs_list=payload.docs_list or [],
        application_url=payload.application_url,
        is_active=payload.is_active if payload.is_active is not None else True,
        description_text=payload.description_text,
        selection_ratio_percent=payload.selection_ratio_percent,
        source_data=payload.source_data or {},
        search_text=" ".join(
            (payload.title, payload.university_name or "", payload.description_text or "")
        ).lower(),
    )
    db.add(item)
    log_audit(
        db,
        actor=admin,
        action="scholarship.create",
        entity="scholarship",
        entity_id=item.scholarship_id,
        after=_scholarship_audit_snapshot(item),
        ip=request_ip(request),
    )
    db.commit()
    db.refresh(item)
    return _admin_scholarship(item)


@router.patch("/scholarships/{scholarship_id}")
def update_scholarship(
    scholarship_id: str,
    payload: ScholarshipPatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Scholarship, scholarship_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    before = _scholarship_audit_snapshot(item)
    changes = payload.model_dump(exclude_unset=True)
    for key in (
        "title",
        "host_country",
        "university_name",
        "application_url",
        "level",
        "scholarship_type",
        "ielts_required",
        "ielts_band",
        "ielts_tier",
        "deadline_date",
        "deadline_kind",
        "fields_list",
        "is_active",
        "description_text",
    ):
        if key in changes:
            setattr(item, key, changes.pop(key))
    if "source_data" in changes:
        item.source_data = {**(item.source_data or {}), **changes["source_data"]}
    if payload.model_fields_set & {"title", "university_name", "description_text"}:
        item.search_text = " ".join(
            (item.title or "", item.university_name or "", item.description_text or "")
        ).lower()
    db.flush()
    log_audit(
        db,
        actor=admin,
        action="scholarship.update",
        entity="scholarship",
        entity_id=scholarship_id,
        before=before,
        after=_scholarship_audit_snapshot(item),
        ip=request_ip(request),
    )
    db.commit()
    db.refresh(item)
    return _admin_scholarship(item)


@router.delete("/scholarships/{scholarship_id}")
def delete_scholarship(
    scholarship_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Scholarship, scholarship_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    saved_exists = (
        db.scalar(select(func.count(SavedScholarship.user_id)).where(SavedScholarship.scholarship_id == scholarship_id))
        or 0
    )
    app_exists = db.scalar(select(func.count(Application.id)).where(Application.scholarship_id == scholarship_id)) or 0
    if saved_exists or app_exists:
        raise HTTPException(
            status_code=409,
            detail="Scholarship is in use and cannot be deleted",
            headers={"X-Error-Code": "SCHOLARSHIP_IN_USE"},
        )
    before = _scholarship_audit_snapshot(item)
    log_audit(
        db,
        actor=admin,
        action="scholarship.delete",
        entity="scholarship",
        entity_id=scholarship_id,
        before=before,
        ip=request_ip(request),
    )
    db.delete(item)
    db.commit()
    return {"deleted": scholarship_id}


@router.post("/scholarships/bulk")
def bulk_scholarships(
    payload: BulkAction,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    ids = payload.ids
    query = select(Scholarship).where(Scholarship.scholarship_id.in_(ids))
    items = list(db.scalars(query).all())
    found_ids = {i.scholarship_id for i in items}
    missing = sorted(set(ids) - found_ids)
    updated = 0
    deleted = 0
    affected = []
    if payload.action == "delete":
        for item in items:
            saved_exists = (
                db.scalar(
                    select(func.count(SavedScholarship.user_id)).where(
                        SavedScholarship.scholarship_id == item.scholarship_id
                    )
                )
                or 0
            )
            app_exists = (
                db.scalar(select(func.count(Application.id)).where(Application.scholarship_id == item.scholarship_id))
                or 0
            )
            if saved_exists or app_exists:
                continue
            before = _scholarship_audit_snapshot(item)
            log_audit(
                db,
                actor=admin,
                action="scholarship.delete",
                entity="scholarship",
                entity_id=item.scholarship_id,
                before=before,
                ip=request_ip(request),
            )
            db.delete(item)
            deleted += 1
            affected.append(item.scholarship_id)
        db.commit()
        return {"action": "delete", "updated": updated, "deleted": deleted, "affected": affected, "missing": missing}
    for item in items:
        before = _scholarship_audit_snapshot(item)
        if payload.action == "activate":
            item.is_active = True
        elif payload.action == "deactivate":
            item.is_active = False
        after = _scholarship_audit_snapshot(item)
        log_audit(
            db,
            actor=admin,
            action=f"scholarship.{payload.action}",
            entity="scholarship",
            entity_id=item.scholarship_id,
            before=before,
            after=after,
            ip=request_ip(request),
        )
        updated += 1
        affected.append(item.scholarship_id)
    db.commit()
    return {"action": payload.action, "updated": updated, "deleted": deleted, "affected": affected, "missing": missing}


@router.get("/scholarships/export-csv")
def export_scholarships_csv(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from fastapi.responses import StreamingResponse

    items = db.scalars(select(Scholarship).order_by(Scholarship.title)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "scholarship_id",
            "title",
            "university_name",
            "host_country",
            "level",
            "scholarship_type",
            "ielts_required",
            "ielts_band",
            "ielts_tier",
            "deadline_date",
            "deadline_kind",
            "is_active",
            "application_url",
        ]
    )
    for item in items:
        writer.writerow(
            [
                item.scholarship_id,
                item.title,
                item.university_name or "",
                item.host_country or "",
                item.level or "",
                item.scholarship_type or "",
                "1" if item.ielts_required else "0",
                item.ielts_band or "",
                item.ielts_tier or "",
                item.deadline_date.isoformat() if item.deadline_date else "",
                item.deadline_kind or "",
                "1" if item.is_active else "0",
                item.application_url or "",
            ]
        )
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=scholarships.csv"},
    )


@router.post("/scholarships/import-csv/dry-run")
async def dry_run_import_scholarships(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Upload a CSV file", headers={"X-Error-Code": "CSV_REQUIRED"})
    content = await file.read(25 * 1024 * 1024 + 1)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="CSV exceeds the 25 MB upload limit", headers={"X-Error-Code": "CSV_TOO_LARGE"}
        )
    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    map_path = Path(os.getenv("DATA_DIR", str(default_data_dir))) / "university_country_map.csv"
    with TemporaryDirectory() as directory:
        csv_path = Path(directory) / "upload.csv"
        csv_path.write_bytes(content)
        map_report = import_country_map(db, map_path)
        report = import_csv(db, csv_path, map_path, dry_run=True)
    return {"country_map": map_report, "import": report}


@router.post("/scholarships/import-csv")
async def import_scholarships(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Upload a CSV file", headers={"X-Error-Code": "CSV_REQUIRED"})
    content = await file.read(25 * 1024 * 1024 + 1)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="CSV exceeds the 25 MB upload limit", headers={"X-Error-Code": "CSV_TOO_LARGE"}
        )
    default_data_dir = Path(__file__).resolve().parents[2] / "data"
    map_path = Path(os.getenv("DATA_DIR", str(default_data_dir))) / "university_country_map.csv"
    with TemporaryDirectory() as directory:
        csv_path = Path(directory) / "upload.csv"
        csv_path.write_bytes(content)
        map_report = import_country_map(db, map_path)
        report = import_csv(db, csv_path, map_path)
    log_audit(
        db,
        actor=admin,
        action="scholarship.import",
        entity="scholarship",
        before=None,
        after={"file": file.filename, **report, "country_map": map_report},
        ip=request_ip(request),
        commit=True,
    )
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


DATA_QUALITY_QUEUES = ("unmapped", "missing_deadline", "missing_url", "ielts_missing_band")


def _data_quality_filters(queue: str):
    if queue == "unmapped":
        return select(UniversityCountry).where(UniversityCountry.confidence < 0.8)
    if queue == "missing_deadline":
        return select(Scholarship).where(
            Scholarship.deadline_kind == "unspecified",
            Scholarship.deadline_date.is_(None),
        )
    if queue == "missing_url":
        return select(Scholarship).where(func.coalesce(Scholarship.application_url, "") == "")
    if queue == "ielts_missing_band":
        return select(Scholarship).where(
            Scholarship.ielts_required.is_(True), func.coalesce(Scholarship.ielts_band, "") == ""
        )
    raise HTTPException(
        status_code=400, detail="Unknown queue", headers={"X-Error-Code": "UNKNOWN_QUEUE"}
    )


@router.get("/data-quality")
def data_quality(
    queue: str = "unmapped",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    if queue not in DATA_QUALITY_QUEUES:
        raise HTTPException(
            status_code=400, detail="Unknown queue", headers={"X-Error-Code": "UNKNOWN_QUEUE"}
        )
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query = _data_quality_filters(queue)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()

    items: list[dict] = []
    if queue == "unmapped":
        items = [
            {"university_name": r.university_name, "host_country": r.host_country, "confidence": r.confidence}
            for r in rows
        ]
    else:
        items = [_admin_scholarship(r) for r in rows]

    counts: dict[str, int] = {}
    for q in DATA_QUALITY_QUEUES:
        if q == queue:
            counts[q] = total
        else:
            counts[q] = db.scalar(select(func.count()).select_from(_data_quality_filters(q).subquery())) or 0

    return {"queue": queue, "items": items, "total": total, "page": page, "page_size": page_size, "counts": counts}


@router.patch("/universities/{university_name}/country")
def update_university_country(
    university_name: str,
    payload: CountryPatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(UniversityCountry, university_name)
    before = {"host_country": item.host_country, "confidence": item.confidence} if item else {"host_country": None}
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
    log_audit(
        db,
        actor=admin,
        action="university.country_update",
        entity="university",
        entity_id=university_name,
        before=before,
        after={"host_country": payload.host_country, "confidence": payload.confidence},
        ip=request_ip(request),
    )
    db.commit()
    return {"university_name": university_name, "host_country": payload.host_country, "confidence": payload.confidence}


@router.get("/users")
def list_users(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    role: str | None = None,
    plan: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    query = select(User).order_by(User.created_at.desc())
    if q:
        query = query.where(User.email.contains(q.lower()) | User.full_name.contains(q))
    if role:
        query = query.where(User.role == role)
    if plan:
        query = query.where(User.plan == plan)
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(query.offset((max(1, page) - 1) * min(page_size, 100)).limit(min(page_size, 100))).all()
    return {
        "items": [
            {
                "id": item.id,
                "email": item.email,
                "full_name": item.full_name,
                "role": item.role,
                "is_active": item.is_active,
                "is_verified": item.is_verified,
                "plan": item.plan,
                "created_at": item.created_at,
            }
            for item in users
        ],
        "total": total,
        "page": max(1, page),
        "page_size": min(page_size, 100),
        "counts": {
            "total": db.scalar(select(func.count(User.id))) or 0,
            "pro": db.scalar(select(func.count(User.id)).where(User.plan == "pro")) or 0,
            "disabled": db.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0,
            "admins": db.scalar(select(func.count(User.id)).where(User.role == "admin")) or 0,
        },
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: AdminUserPatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    changes = payload.model_dump(exclude_unset=True)
    loses_admin = user.role == "admin" and (changes.get("role") == "student" or changes.get("is_active") is False)
    if loses_admin:
        active_admins = (
            db.scalar(select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True))) or 0
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=409,
                detail="At least one active admin account must remain",
                headers={"X-Error-Code": "LAST_ADMIN"},
            )
    if user.id == admin.id:
        if changes.get("is_active") is False:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account",
                headers={"X-Error-Code": "SELF_LOCKOUT"},
            )
        if changes.get("role") == "student":
            raise HTTPException(
                status_code=400,
                detail="You cannot remove your own admin role",
                headers={"X-Error-Code": "SELF_LOCKOUT"},
            )
    before = _user_audit_snapshot(user)
    for key, value in changes.items():
        setattr(user, key, value)
    log_audit(
        db,
        actor=admin,
        action="user.update",
        entity="user",
        entity_id=user.id,
        before=before,
        after=_user_audit_snapshot(user),
        ip=request_ip(request),
    )
    db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "plan": user.plan,
        "role": user.role,
        "is_verified": user.is_verified,
    }


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    stats = {
        "saved": db.scalar(
            select(func.count(SavedScholarship.user_id)).where(SavedScholarship.user_id == user_id)
        )
        or 0,
        "applications": db.scalar(select(func.count(Application.id)).where(Application.user_id == user_id)) or 0,
        "documents": db.scalar(select(func.count(Document.id)).where(Document.user_id == user_id)) or 0,
        "notifications": db.scalar(
            select(func.count(Notification.id)).where(Notification.user_id == user_id)
        )
        or 0,
        "chat_sessions": db.scalar(select(func.count(ChatSession.id)).where(ChatSession.user_id == user_id)) or 0,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login_at.isoformat() if user.last_login_at else None,
        "profile": {
            "onboarding_step": profile.onboarding_step if profile else None,
            "onboarding_completed": profile.onboarding_completed if profile else None,
            "origin_country": profile.origin_country if profile else None,
            "target_level": profile.target_level if profile else None,
            "host_countries": profile.host_countries if profile else None,
            "fields_of_study": profile.fields_of_study if profile else None,
            "gpa_scale": profile.gpa_scale if profile else None,
            "gpa_value": profile.gpa_value if profile else None,
            "ielts_status": profile.ielts_status if profile else None,
            "funding_preference": profile.funding_preference if profile else None,
            "intake_preference": profile.intake_preference if profile else None,
            "bio": profile.bio if profile else None,
        },
        "stats": stats,
        "sessions": [
            {
                "id": t.id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "expires_at": t.expires_at.isoformat() if t.expires_at else None,
                "user_agent": t.user_agent,
                "ip": t.ip,
                "revoked": t.revoked,
            }
            for t in db.scalars(
                select(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .order_by(desc(RefreshToken.created_at))
                .limit(20)
            ).all()
        ],
    }


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    count = db.scalar(
        select(func.count(RefreshToken.id)).where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
    ) or 0
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)).update(
        {RefreshToken.revoked: True}, synchronize_session=False
    )
    log_audit(
        db,
        actor=admin,
        action="user.revoke_sessions",
        entity="user",
        entity_id=user_id,
        after={"revoked": count},
        ip=request_ip(request),
    )
    db.commit()
    return {"revoked": count}


@router.post("/users/{user_id}/reset-onboarding")
def reset_user_onboarding(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if not profile:
        profile = Profile(user_id=user_id, onboarding_step=1, onboarding_completed=False)
        db.add(profile)
    else:
        before = {"onboarding_step": profile.onboarding_step, "onboarding_completed": profile.onboarding_completed}
        profile.onboarding_step = 1
        profile.onboarding_completed = False
        log_audit(
            db,
            actor=admin,
            action="user.reset_onboarding",
            entity="user",
            entity_id=user_id,
            before=before,
            after={"onboarding_step": 1, "onboarding_completed": False},
            ip=request_ip(request),
        )
    db.commit()
    return {"onboarding_step": profile.onboarding_step, "onboarding_completed": profile.onboarding_completed}


@router.get("/users/{user_id}/onboarding")
def get_user_onboarding(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if not profile:
        return {"profile": None}
    return {
        "profile": {
            "onboarding_step": profile.onboarding_step,
            "onboarding_completed": profile.onboarding_completed,
            "origin_country": profile.origin_country,
            "target_level": profile.target_level,
            "host_countries": profile.host_countries,
            "fields_of_study": profile.fields_of_study,
            "ielts_status": profile.ielts_status,
            "gpa_scale": profile.gpa_scale,
            "gpa_value": profile.gpa_value,
            "gpa_4_equivalent": profile.gpa_4_equivalent,
            "bs_marks_obtained": profile.bs_marks_obtained,
            "bs_marks_total": profile.bs_marks_total,
            "funding_preference": profile.funding_preference,
            "extra_preferences": profile.extra_preferences,
            "intake_preference": profile.intake_preference,
            "budget_note": profile.budget_note,
            "bio": profile.bio,
        }
    }

@router.get("/users/{user_id}/sessions")
def get_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[dict]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    sessions = (
        db.scalars(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(desc(ChatSession.updated_at))
            .limit(20)
        )
        .all()
    )
    if not sessions:
        return []
    session_ids = [s.id for s in sessions]
    counts = dict(
        db.execute(
            select(ChatMessage.session_id, func.count(ChatMessage.id))
            .where(ChatMessage.session_id.in_(session_ids))
            .group_by(ChatMessage.session_id)
        ).all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "message_count": counts.get(s.id, 0),
        }
        for s in sessions
    ]


def _template_dict(item: Template) -> dict:
    return {
        "id": item.id,
        "slug": item.slug,
        "title": item.title,
        "category": item.category,
        "description": item.description,
        "body_html": item.body_html,
        "fields_json": item.fields_json,
        "recommended_word_range": item.recommended_word_range,
        "tips": item.tips,
        "is_premium": item.is_premium,
        "is_active": item.is_active,
        "sort_order": item.sort_order,
    }


@router.get("/templates")
def list_templates_admin(
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[dict]:
    query = select(Template)
    if category:
        query = query.where(Template.category == category)
    if q:
        query = query.where(Template.title.contains(q))
    items = db.scalars(query.order_by(Template.sort_order, Template.title)).all()
    return [_template_dict(item) for item in items]


@router.post("/templates")
def create_template(
    payload: TemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    if db.scalar(select(func.count(Template.id)).where(Template.slug == payload.slug)):
        raise HTTPException(
            status_code=409, detail="Slug already in use", headers={"X-Error-Code": "SLUG_TAKEN"}
        )
    item = Template(**payload.model_dump())
    db.add(item)
    log_audit(
        db,
        actor=admin,
        action="template.create",
        entity="template",
        entity_id=item.slug,
        after=_template_dict(item),
        ip=request_ip(request),
    )
    db.commit()
    db.refresh(item)
    return _template_dict(item)


@router.get("/templates/{template_id}")
def get_template_admin(
    template_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Template, template_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    return _template_dict(item)


@router.patch("/templates/{template_id}")
def update_template(
    template_id: int,
    payload: TemplatePatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Template, template_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    changes = payload.model_dump(exclude_unset=True)
    slug = changes.get("slug")
    if slug and slug != item.slug:
        taken = db.scalar(select(func.count(Template.id)).where(Template.slug == slug, Template.id != template_id))
        if taken:
            raise HTTPException(
                status_code=409, detail="Slug already in use", headers={"X-Error-Code": "SLUG_TAKEN"}
            )
    before = _template_dict(item)
    for key, value in changes.items():
        setattr(item, key, value)
    log_audit(
        db,
        actor=admin,
        action="template.update",
        entity="template",
        entity_id=item.slug,
        before=before,
        after=_template_dict(item),
        ip=request_ip(request),
    )
    db.commit()
    db.refresh(item)
    return _template_dict(item)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Template, template_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    uses = db.scalar(select(func.count(Document.id)).where(Document.template_id == template_id)) or 0
    if uses:
        raise HTTPException(
            status_code=409,
            detail="Template is used by documents and cannot be deleted",
            headers={"X-Error-Code": "TEMPLATE_IN_USE"},
        )
    before = _template_dict(item)
    log_audit(
        db,
        actor=admin,
        action="template.delete",
        entity="template",
        entity_id=item.slug,
        before=before,
        ip=request_ip(request),
    )
    db.delete(item)
    db.commit()
    return {"deleted": template_id}


@router.post("/templates/{template_id}/reorder")
def reorder_template(
    template_id: int,
    payload: TemplateReorder,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    item = db.get(Template, template_id)
    if not item:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    before = item.sort_order
    item.sort_order = payload.sort_order
    log_audit(
        db,
        actor=admin,
        action="template.reorder",
        entity="template",
        entity_id=item.slug,
        before={"sort_order": before},
        after={"sort_order": payload.sort_order},
        ip=request_ip(request),
    )
    db.commit()
    return {"id": item.id, "sort_order": item.sort_order}


ANNOUNCEMENT_CHUNK = 500


@router.post("/announcements")
def create_announcement(
    payload: AnnouncementCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    settings = get_settings(db)
    if not settings.get("flags", {}).get("announcements_enabled", True):
        raise HTTPException(
            status_code=409, detail="Announcements are disabled", headers={"X-Error-Code": "ANNOUNCEMENTS_DISABLED"}
        )
    query = select(User.id).where(User.is_active.is_(True))
    if payload.audience == "pro":
        query = query.where(User.plan == "pro")
    elif payload.audience == "free":
        query = query.where(User.plan == "free")
    user_ids = list(db.scalars(query).all())
    delivered = 0
    for start in range(0, len(user_ids), ANNOUNCEMENT_CHUNK):
        db.add_all(
            [
                Notification(
                    user_id=uid,
                    title=payload.title,
                    body=payload.body,
                    kind="announcement",
                    link=payload.link,
                )
                for uid in user_ids[start : start + ANNOUNCEMENT_CHUNK]
            ]
        )
        db.flush()
        delivered += min(ANNOUNCEMENT_CHUNK, len(user_ids) - start)
    log_audit(
        db,
        actor=admin,
        action="announcement.send",
        entity="announcement",
        after={
            "title": payload.title,
            "body": payload.body,
            "audience": payload.audience,
            "link": payload.link,
            "delivered": delivered,
        },
        ip=request_ip(request),
    )
    db.commit()
    return {"delivered": delivered, "audience": payload.audience}


@router.get("/announcements")
def list_announcements(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    query = select(AuditLog).where(AuditLog.action == "announcement.send").order_by(desc(AuditLog.created_at))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((max(1, page) - 1) * min(page_size, 50)).limit(min(page_size, 50))).all()
    return {
        "items": [
            {
                "id": row.id,
                "actor_email": row.actor_email,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                **(row.diff or {}).get("after", {}),
            }
            for row in rows
        ],
        "total": total,
        "page": max(1, page),
        "page_size": min(page_size, 50),
    }


@router.get("/payments")
def payments_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    today = date.today()
    soon = today + timedelta(days=14)
    plan_counts = dict(db.execute(select(User.plan, func.count(User.id)).group_by(User.plan)).all())
    history = [
        {
            "id": row.id,
            "actor_email": row.actor_email,
            "action": row.action,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "diff": row.diff,
        }
        for row in db.scalars(
            select(AuditLog)
            .where(AuditLog.action.in_(["payment.grant", "payment.transfer_approved"]))
            .order_by(desc(AuditLog.created_at))
            .limit(50)
        ).all()
    ]
    return {
        "plan_counts": {"free": plan_counts.get("free", 0), "pro": plan_counts.get("pro", 0)},
        "disabled": db.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0,
        "pro_expiring_soon": db.scalar(
            select(func.count(User.id)).where(
                User.plan == "pro", User.plan_expires_at.is_not(None), User.plan_expires_at <= soon
            )
        )
        or 0,
        "transfer_queue": history,
        "history": history,
        "note": "No payment model yet - grants and transfer approvals are recorded in the audit trail.",
    }


@router.post("/payments/grant")
def grant_plan(
    payload: PaymentGrant,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    before = _user_audit_snapshot(user)
    user.plan = payload.plan
    user.plan_expires_at = payload.expires_at
    log_audit(
        db,
        actor=admin,
        action="payment.grant",
        entity="user",
        entity_id=user.id,
        before=before,
        after={**_user_audit_snapshot(user), "note": payload.note},
        ip=request_ip(request),
    )
    db.commit()
    return {
        "user_id": user.id,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
    }


@router.post("/payments/transfer")
def approve_transfer(
    payload: TransferApproval,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    action = "payment.transfer_approved" if payload.approve else "payment.transfer_rejected"
    log_audit(
        db,
        actor=admin,
        action=action,
        entity="payment",
        entity_id=payload.reference,
        after={"user_id": payload.user_id, "note": payload.note, "approve": payload.approve},
        ip=request_ip(request),
    )
    db.commit()
    return {"reference": payload.reference, "approved": payload.approve}


@router.get("/settings")
def read_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    return get_settings(db)


@router.patch("/settings")
def update_settings(
    payload: SettingsPatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    before = get_settings(db)
    changes = payload.model_dump(exclude_unset=True)
    updated = save_settings(db, changes, commit=False)
    log_audit(
        db,
        actor=admin,
        action="settings.update",
        entity="settings",
        before=before,
        after=updated,
        ip=request_ip(request),
    )
    db.commit()
    return updated


@router.get("/audit")
def list_audit(
    actor: str | None = None,
    action: str | None = None,
    entity: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    query = select(AuditLog)
    if actor:
        query = query.where(AuditLog.actor_email.contains(actor.lower()))
    if action:
        query = query.where(AuditLog.action == action)
    if entity:
        query = query.where(AuditLog.entity == entity)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(desc(AuditLog.created_at))
        .offset((max(1, page) - 1) * min(page_size, 200))
        .limit(min(page_size, 200))
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "actor_id": row.actor_id,
                "actor_email": row.actor_email,
                "action": row.action,
                "entity": row.entity,
                "entity_id": row.entity_id,
                "diff": row.diff,
                "ip": row.ip,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "total": total,
        "page": max(1, page),
        "page_size": min(page_size, 200),
    }


@router.get("/ai-stats")
def ai_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    start_7d = datetime.now().date() - timedelta(days=7)
    sessions = db.scalar(select(func.count(ChatSession.id))) or 0
    messages_7d = db.scalar(
        select(func.count(ChatMessage.id)).where(ChatMessage.created_at >= datetime.combine(start_7d, time.min))
    ) or 0
    tokens_total = db.scalar(select(func.coalesce(func.sum(ChatMessage.tokens), 0))) or 0
    provider_rows = db.execute(
        select(ChatSession.title, func.count(ChatSession.id)).group_by(ChatSession.title)
    ).all()
    recent = []
    for session in db.scalars(select(ChatSession).order_by(desc(ChatSession.created_at)).limit(20)).all():
        owner = db.get(User, session.user_id)
        count = db.scalar(select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session.id)) or 0
        recent.append(
            {
                "id": session.id,
                "user_email": owner.email if owner else None,
                "title": session.title,
                "messages": count,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            }
        )
    return {
        "sessions": sessions,
        "messages_7d": messages_7d,
        "tokens_total": tokens_total,
        "by_provider": {"mock": len(provider_rows)},
        "recent_sessions": recent,
    }


def _user_audit_snapshot(user: User) -> dict:
    return {
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
    }


def _scholarship_audit_snapshot(item: Scholarship) -> dict:
    return {
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "application_url": item.application_url,
        "level": item.level,
        "scholarship_type": item.scholarship_type,
        "deadline_date": item.deadline_date.isoformat() if item.deadline_date else None,
        "deadline_kind": item.deadline_kind,
        "ielts_required": item.ielts_required,
        "ielts_band": item.ielts_band,
        "ielts_tier": item.ielts_tier,
        "fields_list": item.fields_list,
        "is_active": item.is_active,
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
