import hashlib
import hmac
import json
import os
import time
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.ratelimit import limiter
from app.models import Payment, User

router = APIRouter(prefix="/api/billing", tags=["billing"])

STRIPE_API = "https://api.stripe.com/v1"

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "features": ["30 matched opportunities", "5 saved documents", "Basic application tools"],
    },
    {
        "id": "pro_monthly",
        "name": "Pro monthly",
        "price_monthly": 5,
        "price_yearly": None,
        "currency": "USD",
        "features": ["Unlimited matches", "Unlimited saved documents", "Expanded AI limits"],
    },
    {
        "id": "pro_yearly",
        "name": "Pro yearly",
        "price_monthly": None,
        "price_yearly": 40,
        "currency": "USD",
        "features": ["All Pro features", "Annual billing"],
    },
]

PLAN_CONFIG = {
    "pro_monthly": {"amount": 500, "interval": "month", "name": "Scholario Pro (monthly)", "days": 31},
    "pro_yearly": {"amount": 4000, "interval": "year", "name": "Scholario Pro (yearly)", "days": 365},
}


class CheckoutRequest(BaseModel):
    plan: str = Field(min_length=3, max_length=40)


def stripe_enabled() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY", "").strip())


def _frontend_base() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


def _plan_expiry(plan: str | None) -> datetime:
    days = PLAN_CONFIG.get(plan or "", {}).get("days", 31)
    return datetime.now(UTC) + timedelta(days=days)


def _verify_stripe_signature(payload: bytes, header: str, secret: str) -> bool:
    timestamp: str | None = None
    signatures: list[str] = []
    for part in header.split(","):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        if key == "t":
            timestamp = value
        elif key == "v1":
            signatures.append(value)
    if not timestamp or not signatures:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, candidate) for candidate in signatures)


def _event_metadata(obj: dict) -> dict:
    metadata = obj.get("metadata") or {}
    if not metadata:
        subscription_details = obj.get("subscription_details") or {}
        metadata = subscription_details.get("metadata") or {}
    if not metadata:
        parent = obj.get("parent") or {}
        parent_details = parent.get("subscription_details") or {}
        metadata = parent_details.get("metadata") or {}
    return metadata


def _record_success(
    db: Session,
    *,
    provider_ref: str,
    user_id: int,
    plan: str | None,
    amount: float | None,
    currency: str | None,
    event: dict,
) -> None:
    existing = db.scalar(select(Payment).where(Payment.provider_ref == provider_ref))
    if existing is not None and existing.status == "succeeded":
        return
    payment = existing or Payment(provider="stripe", provider_ref=provider_ref, user_id=user_id)
    payment.user_id = user_id
    payment.status = "succeeded"
    payment.plan = plan
    payment.amount = amount
    payment.currency = currency
    payment.raw_json = event
    if existing is None:
        db.add(payment)
    user = db.get(User, user_id)
    if user is not None:
        user.plan = "pro"
        user.plan_expires_at = _plan_expiry(plan)
    db.commit()


@router.get("/plans")
def plans(user: User = Depends(get_current_user)) -> dict:
    return {"plans": PLANS, "current_plan": user.plan, "checkout_enabled": stripe_enabled()}


@router.post("/checkout")
@limiter.limit("10/minute")
def checkout(
    payload: CheckoutRequest,
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    config = PLAN_CONFIG.get(payload.plan)
    if config is None:
        raise HTTPException(
            status_code=400, detail="Unknown plan", headers={"X-Error-Code": "PLAN_UNKNOWN"}
        )
    secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="No payment provider is configured",
            headers={"X-Error-Code": "PAYMENTS_DISABLED"},
        )
    base = _frontend_base()
    form = {
        "mode": "subscription",
        "success_url": f"{base}/billing?checkout=success",
        "cancel_url": f"{base}/billing?checkout=cancelled",
        "client_reference_id": str(user.id),
        "customer_email": user.email,
        "metadata[user_id]": str(user.id),
        "metadata[plan]": payload.plan,
        "subscription_data[metadata][user_id]": str(user.id),
        "subscription_data[metadata][plan]": payload.plan,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(config["amount"]),
        "line_items[0][price_data][recurring][interval]": config["interval"],
        "line_items[0][price_data][product_data][name]": config["name"],
    }
    try:
        response = httpx.post(
            f"{STRIPE_API}/checkout/sessions",
            data=form,
            headers={"Authorization": f"Bearer {secret}"},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the payment provider. Please try again.",
            headers={"X-Error-Code": "PAYMENT_UNAVAILABLE"},
        ) from exc
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="The payment provider rejected the checkout request.",
            headers={"X-Error-Code": "PAYMENT_ERROR"},
        )
    session = response.json()
    return {"url": session.get("url"), "id": session.get("id")}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook secret is not configured",
            headers={"X-Error-Code": "PAYMENTS_DISABLED"},
        )
    payload = await request.body()
    if not _verify_stripe_signature(payload, request.headers.get("stripe-signature", ""), secret):
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature",
            headers={"X-Error-Code": "STRIPE_SIGNATURE_INVALID"},
        )
    try:
        event = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload",
            headers={"X-Error-Code": "STRIPE_PAYLOAD_INVALID"},
        ) from exc

    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}
    metadata = _event_metadata(obj)

    if event_type == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or metadata.get("user_id")
        provider_ref = obj.get("id")
        if user_id and provider_ref:
            amount_total = obj.get("amount_total")
            _record_success(
                db,
                provider_ref=str(provider_ref),
                user_id=int(user_id),
                plan=metadata.get("plan"),
                amount=(amount_total / 100) if amount_total is not None else None,
                currency=obj.get("currency"),
                event=event,
            )
    elif event_type == "invoice.paid":
        user_id = metadata.get("user_id")
        provider_ref = obj.get("id")
        if user_id and provider_ref:
            amount_paid = obj.get("amount_paid")
            _record_success(
                db,
                provider_ref=str(provider_ref),
                user_id=int(user_id),
                plan=metadata.get("plan"),
                amount=(amount_paid / 100) if amount_paid is not None else None,
                currency=obj.get("currency"),
                event=event,
            )

    return {"received": True}


@router.get("/history")
def history(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    rows = db.scalars(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()).limit(50)
    ).all()
    return [
        {
            "id": row.id,
            "provider": row.provider,
            "reference": row.provider_ref,
            "amount": row.amount,
            "currency": row.currency,
            "plan": row.plan,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]
