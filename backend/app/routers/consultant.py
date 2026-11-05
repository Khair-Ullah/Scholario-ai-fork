import csv
import io
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.permissions import require_consultant
from app.models import (
    Application,
    ConsultantWarning,
    Notification,
    Profile,
    SavedScholarship,
    Scholarship,
    User,
)
from app.routers.admin import (
    AnnouncementCreate,
    BulkAction,
    ScholarshipCreate,
    ScholarshipPatch,
    _admin_scholarship,
    _scholarship_audit_snapshot,
)
from app.services import anomaly
from app.services.audit import log_audit, request_ip
from app.services.export import csv_safe
from app.services.settings import get_settings

router = APIRouter(prefix="/api/consultant", tags=["consultant"])

ANNOUNCEMENT_CHUNK = 500


def _owned_ids(db: Session, consultant: User) -> list[str]:
    return list(
        db.scalars(
            select(Scholarship.scholarship_id).where(Scholarship.owner_id == consultant.id)
        ).all()
    )


def _get_owned(db: Session, consultant: User, scholarship_id: str) -> Scholarship:
    item = db.get(Scholarship, scholarship_id)
    if not item or item.owner_id != consultant.id:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    return item


class ConsultantProfilePatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)


@router.get("/stats")
def consultant_stats(
    db: Session = Depends(get_db), consultant: User = Depends(require_consultant)
) -> dict:
    owned_ids = _owned_ids(db, consultant)
    scholarships = len(owned_ids)
    active = (
        db.scalar(
            select(func.count(Scholarship.scholarship_id)).where(
                Scholarship.owner_id == consultant.id, Scholarship.is_active.is_(True)
            )
        )
        or 0
    )
    saves = 0
    applications = 0
    applicant_ids: set[int] = set()
    if owned_ids:
        saves = (
            db.scalar(
                select(func.count()).select_from(SavedScholarship).where(
                    SavedScholarship.scholarship_id.in_(owned_ids)
                )
            )
            or 0
        )
        applications = (
            db.scalar(
                select(func.count(Application.id)).where(Application.scholarship_id.in_(owned_ids))
            )
            or 0
        )
        applicant_ids = {
            r for r in db.scalars(
                select(SavedScholarship.user_id).where(SavedScholarship.scholarship_id.in_(owned_ids))
            ).all()
        } | {
            r for r in db.scalars(
                select(Application.user_id).where(Application.scholarship_id.in_(owned_ids))
            ).all()
        }
    open_warnings = (
        db.scalar(
            select(func.count(ConsultantWarning.id)).where(
                ConsultantWarning.consultant_id == consultant.id,
                ConsultantWarning.is_acknowledged.is_(False),
            )
        )
        or 0
    )
    return {
        "scholarships": scholarships,
        "active_scholarships": active,
        "applicants": len(applicant_ids),
        "saves": saves,
        "applications": applications,
        "open_warnings": open_warnings,
    }


@router.get("/scholarships")
def list_scholarships(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    level: str | None = None,
    host_country: str | None = None,
    is_active: bool | None = None,
    sort: str | None = None,
    order: str | None = None,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query = select(Scholarship).where(Scholarship.owner_id == consultant.id)
    if q:
        query = query.where(Scholarship.search_text.contains(q.lower()))
    if level:
        query = query.where(Scholarship.level == level)
    if host_country:
        query = query.where(Scholarship.host_country == host_country)
    if is_active is not None:
        query = query.where(Scholarship.is_active.is_(is_active))
    direction = desc if (order or "asc").lower() == "desc" else (lambda x: x)
    if sort == "deadline":
        query = query.order_by(direction(Scholarship.deadline_date))
    elif sort == "scholarship_id":
        query = query.order_by(direction(Scholarship.scholarship_id))
    else:
        query = query.order_by(direction(Scholarship.title))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [_admin_scholarship(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/scholarships")
def create_scholarship(
    payload: ScholarshipCreate,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
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
        owner_id=consultant.id,
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
        actor=consultant,
        action="scholarship.create",
        entity="scholarship",
        entity_id=item.scholarship_id,
        after=_scholarship_audit_snapshot(item),
        ip=request_ip(request),
    )
    db.commit()
    db.refresh(item)
    return _admin_scholarship(item)


@router.get("/scholarships/export-csv")
def export_scholarships_csv(
    db: Session = Depends(get_db), consultant: User = Depends(require_consultant)
):
    from fastapi.responses import StreamingResponse

    items = db.scalars(
        select(Scholarship).where(Scholarship.owner_id == consultant.id).order_by(Scholarship.title)
    ).all()
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
            "deadline_date",
            "deadline_kind",
            "is_active",
            "application_url",
        ]
    )
    for item in items:
        writer.writerow(
            [
                csv_safe(item.scholarship_id),
                csv_safe(item.title),
                csv_safe(item.university_name or ""),
                csv_safe(item.host_country or ""),
                csv_safe(item.level or ""),
                csv_safe(item.scholarship_type or ""),
                item.deadline_date.isoformat() if item.deadline_date else "",
                csv_safe(item.deadline_kind or ""),
                "1" if item.is_active else "0",
                csv_safe(item.application_url or ""),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=my-scholarships.csv"},
    )


@router.get("/scholarships/{scholarship_id}")
def get_scholarship(
    scholarship_id: str,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    item = _get_owned(db, consultant, scholarship_id)
    return _admin_scholarship(item)


@router.patch("/scholarships/{scholarship_id}")
def update_scholarship(
    scholarship_id: str,
    payload: ScholarshipPatch,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    item = _get_owned(db, consultant, scholarship_id)
    before = _scholarship_audit_snapshot(item)
    changes = payload.model_dump(exclude_unset=True)
    changes.pop("owner_id", None)  # consultants cannot reassign ownership
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
        actor=consultant,
        action="scholarship.update",
        entity="scholarship",
        entity_id=scholarship_id,
        before=before,
        after=_scholarship_audit_snapshot(item),
        ip=request_ip(request),
    )
    anomaly.evaluate_consultant(db, consultant)
    db.commit()
    db.refresh(item)
    return _admin_scholarship(item)


@router.delete("/scholarships/{scholarship_id}")
def delete_scholarship(
    scholarship_id: str,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    item = _get_owned(db, consultant, scholarship_id)
    saved_exists = (
        db.scalar(
            select(func.count(SavedScholarship.user_id)).where(
                SavedScholarship.scholarship_id == scholarship_id
            )
        )
        or 0
    )
    app_exists = (
        db.scalar(select(func.count(Application.id)).where(Application.scholarship_id == scholarship_id)) or 0
    )
    if saved_exists or app_exists:
        raise HTTPException(
            status_code=409,
            detail="Scholarship is in use and cannot be deleted",
            headers={"X-Error-Code": "SCHOLARSHIP_IN_USE"},
        )
    before = _scholarship_audit_snapshot(item)
    log_audit(
        db,
        actor=consultant,
        action="scholarship.delete",
        entity="scholarship",
        entity_id=scholarship_id,
        before=before,
        ip=request_ip(request),
    )
    db.delete(item)
    anomaly.evaluate_consultant(db, consultant)
    db.commit()
    return {"deleted": scholarship_id}


@router.post("/scholarships/bulk")
def bulk_scholarships(
    payload: BulkAction,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    query = select(Scholarship).where(
        Scholarship.owner_id == consultant.id, Scholarship.scholarship_id.in_(payload.ids)
    )
    items = list(db.scalars(query).all())
    found_ids = {i.scholarship_id for i in items}
    missing = sorted(set(payload.ids) - found_ids)
    updated = 0
    deleted = 0
    affected = []
    if payload.action == "delete":
        for item in items:
            saved = (
                db.scalar(
                    select(func.count(SavedScholarship.user_id)).where(
                        SavedScholarship.scholarship_id == item.scholarship_id
                    )
                )
                or 0
            )
            apps = (
                db.scalar(
                    select(func.count(Application.id)).where(
                        Application.scholarship_id == item.scholarship_id
                    )
                )
                or 0
            )
            if saved or apps:
                continue
            before = _scholarship_audit_snapshot(item)
            log_audit(
                db,
                actor=consultant,
                action="scholarship.delete",
                entity="scholarship",
                entity_id=item.scholarship_id,
                before=before,
                ip=request_ip(request),
            )
            db.delete(item)
            deleted += 1
            affected.append(item.scholarship_id)
        anomaly.evaluate_consultant(db, consultant)
        db.commit()
        return {"action": "delete", "updated": updated, "deleted": deleted, "affected": affected, "missing": missing}
    for item in items:
        before = _scholarship_audit_snapshot(item)
        item.is_active = payload.action == "activate"
        log_audit(
            db,
            actor=consultant,
            action=f"scholarship.{payload.action}",
            entity="scholarship",
            entity_id=item.scholarship_id,
            before=before,
            after=_scholarship_audit_snapshot(item),
            ip=request_ip(request),
        )
        updated += 1
        affected.append(item.scholarship_id)
    db.commit()
    return {"action": payload.action, "updated": updated, "deleted": deleted, "affected": affected, "missing": missing}


@router.get("/applicants")
def list_applicants(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    owned_ids = _owned_ids(db, consultant)
    if not owned_ids:
        return {"items": [], "total": 0, "page": 1, "page_size": page_size}
    saved_users = set(
        db.scalars(
            select(SavedScholarship.user_id).where(SavedScholarship.scholarship_id.in_(owned_ids))
        ).all()
    )
    app_users = set(
        db.scalars(select(Application.user_id).where(Application.scholarship_id.in_(owned_ids))).all()
    )
    user_ids = saved_users | app_users
    if not user_ids:
        return {"items": [], "total": 0, "page": 1, "page_size": page_size}
    query = select(User).where(User.id.in_(user_ids)).order_by(User.created_at.desc())
    if q:
        query = query.where(User.email.contains(q.lower()) | User.full_name.contains(q))
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    page_user_ids = [user.id for user in rows]
    profiles: dict[int, Profile] = {}
    save_counts: dict[int, int] = {}
    app_counts: dict[int, int] = {}
    if page_user_ids:
        profiles = {
            profile.user_id: profile
            for profile in db.scalars(select(Profile).where(Profile.user_id.in_(page_user_ids))).all()
        }
        save_counts = dict(
            db.execute(
                select(SavedScholarship.user_id, func.count())
                .where(
                    SavedScholarship.user_id.in_(page_user_ids),
                    SavedScholarship.scholarship_id.in_(owned_ids),
                )
                .group_by(SavedScholarship.user_id)
            ).all()
        )
        app_counts = dict(
            db.execute(
                select(Application.user_id, func.count(Application.id))
                .where(
                    Application.user_id.in_(page_user_ids),
                    Application.scholarship_id.in_(owned_ids),
                )
                .group_by(Application.user_id)
            ).all()
        )
    items = []
    for user in rows:
        profile = profiles.get(user.id)
        items.append(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "plan": user.plan,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "origin_country": profile.origin_country if profile else None,
                "target_level": profile.target_level if profile else None,
                "host_countries": profile.host_countries if profile else None,
                "fields_of_study": profile.fields_of_study if profile else None,
                "saves": save_counts.get(user.id, 0),
                "applications": app_counts.get(user.id, 0),
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/applicants/{user_id}")
def get_applicant(
    user_id: int,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    owned_ids = _owned_ids(db, consultant)
    if not owned_ids:
        raise HTTPException(status_code=404, detail="Applicant not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    user = db.get(User, user_id)
    in_scope = (
        db.scalar(
            select(func.count()).select_from(SavedScholarship).where(
                SavedScholarship.user_id == user_id, SavedScholarship.scholarship_id.in_(owned_ids)
            )
        )
        or 0
    ) or (
        db.scalar(
            select(func.count(Application.id)).where(
                Application.user_id == user_id, Application.scholarship_id.in_(owned_ids)
            )
        )
        or 0
    )
    if not user or not in_scope:
        raise HTTPException(status_code=404, detail="Applicant not found", headers={"X-Error-Code": "USER_NOT_FOUND"})
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    saved_items = db.execute(
        select(SavedScholarship.scholarship_id, Scholarship.title)
        .join(Scholarship, Scholarship.scholarship_id == SavedScholarship.scholarship_id)
        .where(SavedScholarship.user_id == user_id, SavedScholarship.scholarship_id.in_(owned_ids))
    ).all()
    applications = db.execute(
        select(Application.scholarship_id, Scholarship.title, Application.status)
        .join(Scholarship, Scholarship.scholarship_id == Application.scholarship_id)
        .where(Application.user_id == user_id, Application.scholarship_id.in_(owned_ids))
    ).all()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "profile": {
            "origin_country": profile.origin_country if profile else None,
            "target_level": profile.target_level if profile else None,
            "host_countries": profile.host_countries if profile else None,
            "fields_of_study": profile.fields_of_study if profile else None,
            "gpa_scale": profile.gpa_scale if profile else None,
            "gpa_value": profile.gpa_value if profile else None,
            "ielts_status": profile.ielts_status if profile else None,
            "funding_preference": profile.funding_preference if profile else None,
            "bio": profile.bio if profile else None,
        } if profile else None,
        "saved": [{"scholarship_id": r[0], "title": r[1]} for r in saved_items],
        "applications": [{"scholarship_id": r[0], "title": r[1], "status": r[2]} for r in applications],
    }


@router.get("/warnings")
def list_my_warnings(
    include_acknowledged: bool = True,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> list[dict]:
    query = select(ConsultantWarning).where(ConsultantWarning.consultant_id == consultant.id)
    if not include_acknowledged:
        query = query.where(ConsultantWarning.is_acknowledged.is_(False))
    rows = db.scalars(query.order_by(desc(ConsultantWarning.created_at)).limit(100)).all()
    return [
        {
            "id": w.id,
            "severity": w.severity,
            "category": w.category,
            "reason": w.reason,
            "detail": w.detail,
            "is_acknowledged": w.is_acknowledged,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in rows
    ]


@router.post("/warnings/{warning_id}/ack")
def acknowledge_warning(
    warning_id: int,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    warning = db.get(ConsultantWarning, warning_id)
    if not warning or warning.consultant_id != consultant.id:
        raise HTTPException(status_code=404, detail="Warning not found", headers={"X-Error-Code": "WARNING_NOT_FOUND"})
    warning.is_acknowledged = True
    warning.acknowledged_at = datetime.now(UTC)
    log_audit(
        db,
        actor=consultant,
        action="consultant.warning_acknowledged",
        entity="warning",
        entity_id=warning.id,
        ip=request_ip(request),
    )
    db.commit()
    return {"id": warning.id, "is_acknowledged": warning.is_acknowledged}


@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db), consultant: User = Depends(require_consultant)
) -> dict:
    return {
        "id": consultant.id,
        "email": consultant.email,
        "full_name": consultant.full_name,
        "role": consultant.role,
        "totp_enabled": consultant.totp_enabled,
        "created_at": consultant.created_at.isoformat() if consultant.created_at else None,
        "last_login_at": consultant.last_login_at.isoformat() if consultant.last_login_at else None,
    }


@router.patch("/profile")
def update_profile(
    payload: ConsultantProfilePatch,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    if payload.full_name is not None:
        consultant.full_name = payload.full_name.strip()
    db.commit()
    return {"id": consultant.id, "full_name": consultant.full_name}


@router.post("/announcements")
def send_announcement(
    payload: AnnouncementCreate,
    request: Request,
    db: Session = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> dict:
    if not get_settings(db).get("flags", {}).get("announcements_enabled", True):
        raise HTTPException(
            status_code=409, detail="Announcements are disabled", headers={"X-Error-Code": "ANNOUNCEMENTS_DISABLED"}
        )
    owned_ids = _owned_ids(db, consultant)
    if not owned_ids:
        return {"delivered": 0}
    user_ids = set(
        db.scalars(
            select(SavedScholarship.user_id).where(SavedScholarship.scholarship_id.in_(owned_ids))
        ).all()
    ) | set(
        db.scalars(select(Application.user_id).where(Application.scholarship_id.in_(owned_ids))).all()
    )
    user_ids = list(user_ids)
    delivered = 0
    for start in range(0, len(user_ids), ANNOUNCEMENT_CHUNK):
        chunk = user_ids[start : start + ANNOUNCEMENT_CHUNK]
        db.add_all(
            [
                Notification(
                    user_id=uid,
                    title=payload.title,
                    body=payload.body,
                    kind="announcement",
                    link=payload.link,
                )
                for uid in chunk
            ]
        )
        db.flush()
        delivered += len(chunk)
    log_audit(
        db,
        actor=consultant,
        action="announcement.send",
        entity="announcement",
        after={"title": payload.title, "audience": "applicants", "delivered": delivered},
        ip=request_ip(request),
    )
    db.commit()
    return {"delivered": delivered}
