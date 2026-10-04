from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import Application, ChecklistItem, SavedScholarship, Scholarship, User
from app.schemas.student_data import ApplicationCreate, ApplicationUpdate, ChecklistCreate, ChecklistUpdate, SavedCreate
from app.services.csv_import import parse_bool

router = APIRouter(prefix="/api", tags=["student workspace"])


def _scholarship_exists(db: Session, scholarship_id: str) -> bool:
    return db.get(Scholarship, scholarship_id) is not None


@router.get("/saved")
def list_saved(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.scalars(
        select(SavedScholarship).where(SavedScholarship.user_id == user.id).order_by(SavedScholarship.created_at.desc())
    ).all()
    return [
        {
            "scholarship_id": row.scholarship_id,
            "note": row.note,
            "created_at": row.created_at,
            "scholarship": _scholarship_summary(db, row.scholarship_id),
        }
        for row in rows
    ]


@router.post("/saved", status_code=201)
def save_scholarship(
    payload: SavedCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    if not _scholarship_exists(db, payload.scholarship_id):
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    saved = db.get(SavedScholarship, (user.id, payload.scholarship_id))
    if saved:
        saved.note = payload.note
    else:
        saved = SavedScholarship(user_id=user.id, scholarship_id=payload.scholarship_id, note=payload.note)
        db.add(saved)
    db.commit()
    return {"scholarship_id": saved.scholarship_id, "note": saved.note}


@router.delete("/saved/{scholarship_id}")
def remove_saved(
    scholarship_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    saved = db.get(SavedScholarship, (user.id, scholarship_id))
    if saved:
        db.delete(saved)
        db.commit()
    return {"message": "Removed from saved scholarships"}


@router.get("/applications")
def list_applications(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.scalars(
        select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc())
    ).all()
    return [{**_application_dict(row), "scholarship": _scholarship_summary(db, row.scholarship_id)} for row in rows]


@router.post("/applications", status_code=201)
def create_application(
    payload: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    if not _scholarship_exists(db, payload.scholarship_id):
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    existing = db.scalar(
        select(Application).where(Application.user_id == user.id, Application.scholarship_id == payload.scholarship_id)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This scholarship is already in your tracker",
            headers={"X-Error-Code": "APPLICATION_EXISTS"},
        )
    application = Application(user_id=user.id, **payload.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return _application_dict(application)


@router.patch("/applications/{application_id}")
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    application = db.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(
            status_code=404, detail="Application not found", headers={"X-Error-Code": "APPLICATION_NOT_FOUND"}
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(application, key, value)
    db.commit()
    db.refresh(application)
    return _application_dict(application)


@router.delete("/applications/{application_id}")
def delete_application(
    application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    application = db.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(
            status_code=404, detail="Application not found", headers={"X-Error-Code": "APPLICATION_NOT_FOUND"}
        )
    db.delete(application)
    db.commit()
    return {"message": "Application removed"}


@router.get("/checklist")
def list_checklist(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.scalars(
        select(ChecklistItem)
        .where(ChecklistItem.user_id == user.id)
        .order_by(ChecklistItem.is_done, ChecklistItem.due_date)
    ).all()
    return [_checklist_dict(row) for row in rows]


@router.post("/checklist", status_code=201)
def create_checklist_item(
    payload: ChecklistCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    if payload.scholarship_id and not _scholarship_exists(db, payload.scholarship_id):
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    item = ChecklistItem(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _checklist_dict(item)


@router.patch("/checklist/{item_id}")
def update_checklist_item(
    item_id: int, payload: ChecklistUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    item = db.scalar(select(ChecklistItem).where(ChecklistItem.id == item_id, ChecklistItem.user_id == user.id))
    if not item:
        raise HTTPException(
            status_code=404, detail="Checklist item not found", headers={"X-Error-Code": "CHECKLIST_NOT_FOUND"}
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _checklist_dict(item)


@router.delete("/checklist/{item_id}")
def delete_checklist_item(
    item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    item = db.scalar(select(ChecklistItem).where(ChecklistItem.id == item_id, ChecklistItem.user_id == user.id))
    if not item:
        raise HTTPException(
            status_code=404, detail="Checklist item not found", headers={"X-Error-Code": "CHECKLIST_NOT_FOUND"}
        )
    db.delete(item)
    db.commit()
    return {"message": "Checklist item removed"}


@router.post("/checklist/generate/{scholarship_id}")
def generate_checklist(
    scholarship_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    scholarship = db.get(Scholarship, scholarship_id)
    if not scholarship:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    source = scholarship.source_data or {}
    requirements = [(name, "document") for name in scholarship.docs_list or []]
    for field, title in [
        ("account_required", "Create the required scholarship account"),
        ("attestation_required", "Complete document attestation"),
        ("medical_certificate_required", "Obtain a medical certificate"),
        ("police_clearance_required", "Obtain police clearance"),
        ("local_language_test", "Complete the local language test"),
    ]:
        required, _ = parse_bool(source.get(field)) if field.endswith("_required") else (bool(source.get(field)), None)
        if required:
            requirements.append((title, "requirement"))
    existing = {
        item.title
        for item in db.scalars(
            select(ChecklistItem).where(
                ChecklistItem.user_id == user.id, ChecklistItem.scholarship_id == scholarship_id
            )
        ).all()
    }
    added = []
    for title, category in requirements:
        if title not in existing:
            item = ChecklistItem(user_id=user.id, scholarship_id=scholarship_id, title=title, category=category)
            db.add(item)
            added.append(item)
    db.commit()
    for item in added:
        db.refresh(item)
    return [_checklist_dict(item) for item in added]


def _scholarship_summary(db: Session, scholarship_id: str) -> dict | None:
    item = db.get(Scholarship, scholarship_id)
    if not item:
        return None
    return {
        "scholarship_id": item.scholarship_id,
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "deadline_date": item.deadline_date,
    }


def _application_dict(item: Application) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "scholarship_id": item.scholarship_id,
        "status": item.status,
        "applied_on": item.applied_on,
        "next_step": item.next_step,
        "next_step_date": item.next_step_date,
        "notes": item.notes,
    }


def _checklist_dict(item: ChecklistItem) -> dict:
    return {
        "id": item.id,
        "scholarship_id": item.scholarship_id,
        "title": item.title,
        "is_done": item.is_done,
        "due_date": item.due_date,
        "category": item.category,
    }
