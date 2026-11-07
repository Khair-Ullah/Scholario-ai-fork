import logging
import os
from collections.abc import Callable
from typing import Any

import bleach
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.ratelimit import limiter
from app.models import ChatMessage, ChatSession, Profile, Scholarship, Template, User
from app.schemas.ai import ChatRequest, FillTemplateRequest, ImproveTextRequest, SopReviewRequest
from app.services.ai.base import AIProvider, AIProviderError
from app.services.ai.mock_provider import MockProvider
from app.services.ai.prompts import IMPROVE_SYSTEM
from app.services.ai.registry import get_provider
from app.services.entitlements import is_pro
from app.services.settings import get_settings

logger = logging.getLogger(__name__)


def _require_ai_enabled(db: Session = Depends(get_db)) -> None:
    if not get_settings(db).get("flags", {}).get("ai_enabled", True):
        raise HTTPException(
            status_code=403, detail="AI tools are currently disabled", headers={"X-Error-Code": "AI_DISABLED"}
        )


def _provider(db: Session) -> AIProvider:
    settings = get_settings(db)
    return get_provider(str(settings.get("ai_provider", "mock")))


def _run_ai(provider: AIProvider, action: Callable[[Any], Any]) -> tuple[Any, str]:
    try:
        return action(provider), provider.name
    except AIProviderError as exc:
        logger.warning("AI provider %s failed: %s", provider.name, exc)
        if os.getenv("AI_FALLBACK_TO_MOCK", "true").strip().lower() != "true":
            raise HTTPException(
                status_code=503,
                detail="AI service is temporarily unavailable",
                headers={"X-Error-Code": "AI_UNAVAILABLE"},
            ) from exc
        return action(MockProvider()), "mock-fallback"


def _review_note(provider_name: str) -> str:
    if provider_name.startswith("mock"):
        return "Demo AI feedback; review suggestions and keep all claims truthful."
    return "AI-generated feedback; review suggestions and keep all claims truthful."


router = APIRouter(prefix="/api/ai", tags=["AI tools"], dependencies=[Depends(_require_ai_enabled)])


@router.get("/sessions")
@limiter.limit("20/minute")
def list_sessions(
    request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    sessions = db.scalars(
        select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc())
    ).all()
    return [
        {"id": item.id, "title": item.title, "scholarship_id": item.scholarship_id, "updated_at": item.updated_at}
        for item in sessions
    ]


@router.get("/sessions/{session_id}")
@limiter.limit("20/minute")
def get_session(
    session_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id))
    if not session:
        raise HTTPException(
            status_code=404, detail="Chat session not found", headers={"X-Error-Code": "CHAT_NOT_FOUND"}
        )
    messages = db.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
    ).all()
    return {
        "id": session.id,
        "title": session.title,
        "scholarship_id": session.scholarship_id,
        "messages": [_message_dict(item) for item in messages],
    }


@router.post("/chat")
@limiter.limit("20/minute")
def chat(
    payload: ChatRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    session = None
    if payload.session_id:
        session = db.scalar(
            select(ChatSession).where(ChatSession.id == payload.session_id, ChatSession.user_id == user.id)
        )
        if not session:
            raise HTTPException(
                status_code=404, detail="Chat session not found", headers={"X-Error-Code": "CHAT_NOT_FOUND"}
            )
    scholarship = (
        db.get(Scholarship, payload.scholarship_id)
        if payload.scholarship_id
        else _find_scholarship(db, payload.message)
    )
    if payload.scholarship_id and not scholarship:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    context = [_scholarship_context(scholarship)] if scholarship else []
    if not session:
        session = ChatSession(
            user_id=user.id,
            title=payload.message[:80],
            scholarship_id=scholarship.scholarship_id if scholarship else None,
        )
        db.add(session)
        db.flush()
    user_message = ChatMessage(
        session_id=session.id, role="user", content=payload.message, tokens=len(payload.message.split())
    )
    db.add(user_message)
    answer, provider_name = _run_ai(_provider(db), lambda provider: provider.chat(payload.message, context))
    if not answer:
        answer = "I could not generate an answer from the current scholarship data. Please try rephrasing."
    assistant_message = ChatMessage(session_id=session.id, role="assistant", content=answer, tokens=len(answer.split()))
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return {"session_id": session.id, "message": _message_dict(assistant_message), "provider": provider_name}


@router.post("/sop-review")
@limiter.limit("20/minute")
def review_sop(
    payload: SopReviewRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    result, provider_name = _run_ai(_provider(db), lambda provider: provider.review_sop(payload.text))
    result["provider"] = provider_name
    result["note"] = _review_note(provider_name)
    return result


@router.post("/improve-text")
@limiter.limit("20/minute")
def improve_text(
    payload: ImproveTextRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    text, provider_name = _run_ai(
        _provider(db), lambda provider: provider.improve_text(payload.text, payload.instruction)
    )
    return {"text": text, "provider": provider_name, "system_prompt": IMPROVE_SYSTEM}


@router.post("/fill-template")
@limiter.limit("20/minute")
def fill_template(
    payload: FillTemplateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    template = db.scalar(select(Template).where(Template.slug == payload.slug, Template.is_active.is_(True)))
    if not template:
        raise HTTPException(
            status_code=404, detail="Template not found", headers={"X-Error-Code": "TEMPLATE_NOT_FOUND"}
        )
    if template.is_premium and not is_pro(user):
        raise HTTPException(
            status_code=403, detail="This template requires a Pro plan", headers={"X-Error-Code": "PRO_REQUIRED"}
        )
    output = template.body_html
    for field in template.fields_json:
        key = field["key"]
        value = bleach.clean(payload.answers.get(key, ""), tags=[], strip=True)
        output = output.replace("{{" + key + "}}", value if value else f"[{field['label']}]")
    return {
        "content_html": bleach.clean(
            output, tags=["p", "br", "h1", "h2", "h3", "ul", "ol", "li", "b", "strong", "i", "em"], strip=True
        ),
        "provider": "template",
    }


@router.post("/explain-scholarship/{scholarship_id}")
@limiter.limit("20/minute")
def explain_scholarship(
    scholarship_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    scholarship = db.get(Scholarship, scholarship_id)
    if not scholarship:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    answer, provider_name = _run_ai(
        _provider(db),
        lambda provider: provider.chat(
            "Explain this scholarship in plain language and include its source-data uncertainty.",
            [_scholarship_context(scholarship)],
        ),
    )
    return {"text": answer, "provider": provider_name}


@router.post("/eligibility-check")
@limiter.limit("20/minute")
def eligibility_check(
    scholarship_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    scholarship = db.get(Scholarship, scholarship_id)
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    if not scholarship:
        raise HTTPException(
            status_code=404, detail="Scholarship not found", headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"}
        )
    if not profile or not profile.target_level:
        return {
            "status": "unknown",
            "reasons": ["Complete your study profile to compare requirements."],
            "provider": "rules",
        }
    reasons = []
    if profile.target_level != scholarship.level:
        reasons.append(f"Your target level is {profile.target_level}; the record lists {scholarship.level}.")
    if profile.host_countries and scholarship.host_country not in profile.host_countries:
        reasons.append(f"Your selected destinations do not include {scholarship.host_country}.")
    status = "review" if reasons else "possible"
    return {
        "status": status,
        "reasons": reasons or ["The basic level and destination match. Verify all official eligibility rules."],
        "disclaimer": "This is a preliminary comparison, not an eligibility or admission decision.",
        "provider": "rules",
    }


def _find_scholarship(db: Session, message: str) -> Scholarship | None:
    words = [word for word in message.split() if len(word) > 3]
    for word in words:
        item = db.scalar(
            select(Scholarship)
            .where(Scholarship.search_text.contains(word.lower()), Scholarship.is_active.is_(True))
            .limit(1)
        )
        if item:
            return item
    return None


def _scholarship_context(item: Scholarship) -> dict:
    source = item.source_data or {}
    return {
        "title": item.title,
        "university_name": item.university_name,
        "host_country": item.host_country,
        "deadline": source.get("deadline"),
        "deadline_kind": item.deadline_kind,
        "IELTS_required": source.get("IELTS_required"),
        "IELTS_band_recommendation": item.ielts_band,
        "funding": source.get("funding"),
        "scholarship_type": item.scholarship_type,
        "stipend_monthly_amount": source.get("stipend_monthly_amount"),
        "documents_list_parsed": item.docs_list,
    }


def _message_dict(item: ChatMessage) -> dict:
    return {
        "id": item.id,
        "role": item.role,
        "content": item.content,
        "tokens": item.tokens,
        "created_at": item.created_at,
    }
