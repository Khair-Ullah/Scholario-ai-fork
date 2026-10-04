from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api/billing", tags=["billing"])
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


@router.get("/plans")
def plans(user: User = Depends(get_current_user)) -> dict:
    return {"plans": PLANS, "current_plan": user.plan, "checkout_enabled": False}


@router.post("/checkout")
def checkout(user: User = Depends(get_current_user)) -> None:
    raise HTTPException(
        status_code=503, detail="No payment provider is configured", headers={"X-Error-Code": "PAYMENTS_DISABLED"}
    )


@router.get("/history")
def history(user: User = Depends(get_current_user)) -> list:
    return []
