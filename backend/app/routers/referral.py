import os

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import User

router = APIRouter(prefix="/api/referral", tags=["referral"])


def _frontend_base_url() -> str:
    base = (
        os.getenv("FRONTEND_BASE_URL")
        or os.getenv("FRONTEND_ORIGINS", "").split(",")[0].strip()
        or os.getenv("PUBLIC_BASE_URL", "http://localhost:3000")
    )
    return base.rstrip("/")


@router.get("")
def referral_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    total = db.scalar(select(func.count(User.id)).where(User.referred_by_id == user.id)) or 0
    base_url = _frontend_base_url()
    return {
        "code": user.referral_code,
        "link": f"{base_url}/register?ref={user.referral_code}",
        "invited": total,
        "reward_threshold": 3,
        "reward_description": "Three completed referrals earn one month of Pro after referral rewards are enabled.",
    }
