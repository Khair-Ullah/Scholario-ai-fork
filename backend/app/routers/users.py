
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.models import Profile, User
from app.schemas.profile import ProfileUpdate
from app.schemas.user import PasswordChange, UserPublic
from app.services.gpa import bs_marks_to_g4, to_g4

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    return {"user": UserPublic.model_validate(user), "profile": jsonable_encoder(profile)}


@router.patch("/me")
def update_me(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    full_name = updates.pop("full_name", None)
    if full_name is not None:
        user.full_name = full_name.strip()
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    if profile is None:
        profile = Profile(user_id=user.id, host_countries=[], fields_of_study=[], extra_preferences={})
        db.add(profile)
    for key, value in updates.items():
        setattr(profile, key, value)
    if profile.gpa_value is not None and profile.gpa_scale:
        profile.gpa_4_equivalent = to_g4(profile.gpa_scale, profile.gpa_value)
    elif profile.bs_marks_obtained is not None and profile.bs_marks_total:
        profile.gpa_4_equivalent = bs_marks_to_g4(profile.bs_marks_obtained, profile.bs_marks_total)
    db.commit()
    db.refresh(user)
    return {"user": UserPublic.model_validate(user), "profile": jsonable_encoder(profile)}


@router.post("/me/password")
def change_password(
    payload: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, str]:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=400, detail="Current password is incorrect", headers={"X-Error-Code": "PASSWORD_INVALID"}
        )
    user.password_hash = hash_password(payload.new_password)
    for token in user.refresh_tokens:
        token.revoked = True
    db.commit()
    return {"message": "Password updated. Sign in again on other devices."}


@router.delete("/me", status_code=204)
def delete_account(
    response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Response:
    db.delete(user)
    db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")
    response.status_code = 204
    return response
