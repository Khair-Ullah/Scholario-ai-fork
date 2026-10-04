import bleach
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import Document, DocumentVersion, Scholarship, Template, User
from app.schemas.document import DocumentCreate, DocumentUpdate
from app.services.export import export_document

router = APIRouter(prefix="/api", tags=["templates", "documents"])
ALLOWED_TAGS = ["p", "br", "h1", "h2", "h3", "ul", "ol", "li", "b", "strong", "i", "em", "a", "blockquote"]


@router.get("/templates")
def list_templates(
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    query = select(Template).where(Template.is_active.is_(True)).order_by(Template.sort_order, Template.title)
    if category:
        query = query.where(Template.category == category)
    items = db.scalars(query).all()
    if q:
        needle = q.strip().lower()
        items = [item for item in items if needle in item.title.lower() or needle in item.description.lower()]
    return [_template_dict(item, include_body=False) for item in items]


@router.get("/templates/{slug}")
def get_template(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    item = db.scalar(select(Template).where(Template.slug == slug, Template.is_active.is_(True)))
    if not item:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    if item.is_premium and user.plan != "pro":
        raise HTTPException(
            status_code=403, detail="This template requires a Pro plan", headers={"X-Error-Code": "PRO_REQUIRED"}
        )
    return _template_dict(item)


@router.get("/documents")
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    items = db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.updated_at.desc())).all()
    return [_document_dict(item) for item in items]


@router.post("/documents", status_code=201)
def create_document(
    payload: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    count = db.scalar(select(func.count(Document.id)).where(Document.user_id == user.id)) or 0
    if user.plan == "free" and count >= 5:
        raise HTTPException(
            status_code=403, detail="Free plan allows five saved documents", headers={"X-Error-Code": "DOCUMENT_LIMIT"}
        )
    if payload.scholarship_id and not db.get(Scholarship, payload.scholarship_id):
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    template = db.get(Template, payload.template_id) if payload.template_id else None
    if payload.template_id and not template:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    if template and template.is_premium and user.plan != "pro":
        raise HTTPException(
            status_code=403, detail="This template requires a Pro plan", headers={"X-Error-Code": "PRO_REQUIRED"}
        )
    content = _sanitize(payload.content_html)
    document = Document(
        user_id=user.id,
        template_id=payload.template_id,
        scholarship_id=payload.scholarship_id,
        title=payload.title.strip(),
        doc_type=payload.doc_type or (template.category if template else None),
        content_html=content,
        content_json=payload.content_json,
        placeholders_json=payload.placeholders_json,
        word_count=_word_count(content),
        status=payload.status,
        version=1,
    )
    db.add(document)
    db.flush()
    db.add(DocumentVersion(document_id=document.id, version=1, content_html=content))
    db.commit()
    db.refresh(document)
    return _document_dict(document)


@router.get("/documents/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return _owned_document(db, user.id, document_id)


@router.put("/documents/{document_id}")
def update_document(
    document_id: int, payload: DocumentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if not document:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    updates = payload.model_dump(exclude_unset=True)
    if "content_html" in updates and updates["content_html"] is not None:
        updates["content_html"] = _sanitize(updates["content_html"])
    for key, value in updates.items():
        setattr(document, key, value)
    document.word_count = _word_count(document.content_html)
    document.version += 1
    db.add(DocumentVersion(document_id=document.id, version=document.version, content_html=document.content_html))
    db.flush()
    old_versions = db.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.version.desc())
        .offset(30)
    ).all()
    for old in old_versions:
        db.delete(old)
    db.commit()
    db.refresh(document)
    return _document_dict(document)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Response:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if not document:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    db.delete(document)
    db.commit()
    return Response(status_code=204)


@router.get("/documents/{document_id}/versions")
def list_versions(
    document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    _owned_document(db, user.id, document_id)
    versions = db.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version.desc())
    ).all()
    return [{"version": item.version, "created_at": item.created_at} for item in versions]


@router.post("/documents/{document_id}/restore/{version}")
def restore_version(
    document_id: int, version: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if not document:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    snapshot = db.scalar(
        select(DocumentVersion).where(DocumentVersion.document_id == document.id, DocumentVersion.version == version)
    )
    if not snapshot:
        raise HTTPException(
            status_code=404, detail="Document version not found", headers={"X-Error-Code": "VERSION_NOT_FOUND"}
        )
    document.version += 1
    document.content_html = snapshot.content_html
    document.word_count = _word_count(document.content_html)
    db.add(DocumentVersion(document_id=document.id, version=document.version, content_html=document.content_html))
    db.commit()
    db.refresh(document)
    return _document_dict(document)


@router.post("/documents/{document_id}/duplicate", status_code=201)
def duplicate_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    original = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if not original:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    copy = Document(
        user_id=user.id,
        template_id=original.template_id,
        scholarship_id=original.scholarship_id,
        title=f"{original.title} (copy)",
        doc_type=original.doc_type,
        content_html=original.content_html,
        content_json=original.content_json,
        placeholders_json=original.placeholders_json,
        word_count=original.word_count,
        status="draft",
        version=1,
    )
    db.add(copy)
    db.flush()
    db.add(DocumentVersion(document_id=copy.id, version=1, content_html=copy.content_html))
    db.commit()
    db.refresh(copy)
    return _document_dict(copy)


@router.get("/documents/{document_id}/export")
def export(
    document_id: int,
    format: str = Query(pattern="^(docx|pdf|txt)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user.id))
    if not document:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    data, media_type, filename = export_document(document.content_html, document.title, format)
    return Response(data, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _owned_document(db: Session, user_id: int, document_id: int) -> dict:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user_id))
    if not document:
        raise HTTPException(
            status_code=404, detail="Document not found", headers={"X-Error-Code": "DOCUMENT_NOT_FOUND"}
        )
    return _document_dict(document)


def _document_dict(item: Document) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "template_id": item.template_id,
        "template_slug": item.template.slug if item.template else None,
        "scholarship_id": item.scholarship_id,
        "doc_type": item.doc_type,
        "content_html": item.content_html,
        "content_json": item.content_json,
        "placeholders_json": item.placeholders_json,
        "word_count": item.word_count,
        "status": item.status,
        "version": item.version,
        "updated_at": item.updated_at,
    }


def _template_dict(item: Template, include_body: bool = True) -> dict:
    result = {
        "id": item.id,
        "slug": item.slug,
        "title": item.title,
        "category": item.category,
        "description": item.description,
        "fields_json": item.fields_json,
        "recommended_word_range": item.recommended_word_range,
        "tips": item.tips,
        "is_premium": item.is_premium,
    }
    if include_body:
        result["body_html"] = item.body_html
    return result


def _sanitize(content: str) -> str:
    return bleach.clean(content, tags=ALLOWED_TAGS, attributes={"a": ["href", "title"]}, strip=True)


def _word_count(content: str) -> int:
    return len(bleach.clean(content, tags=[], strip=True).split())
