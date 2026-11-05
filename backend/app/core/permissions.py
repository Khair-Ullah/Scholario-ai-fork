from collections.abc import Callable

from fastapi import Depends, HTTPException

from app.core.deps import get_current_user
from app.models import Scholarship, User

ROLE_STUDENT = "student"
ROLE_CONSULTANT = "consultant"
ROLE_SUPER_ADMIN = "super_admin"
STAFF_ROLES = frozenset({ROLE_CONSULTANT, ROLE_SUPER_ADMIN})
VALID_ROLES = frozenset({ROLE_STUDENT, ROLE_CONSULTANT, ROLE_SUPER_ADMIN})


def _forbidden(detail: str, code: str) -> HTTPException:
    return HTTPException(status_code=403, detail=detail, headers={"X-Error-Code": code})


def require_roles(*roles: str) -> Callable[..., User]:
    allowed = frozenset(roles)

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise _forbidden("You do not have access to this resource", "AUTH_FORBIDDEN")
        return user

    return dependency


require_super_admin = require_roles(ROLE_SUPER_ADMIN)
require_consultant = require_roles(ROLE_CONSULTANT)


def require_staff(user: User = Depends(get_current_user)) -> User:
    if user.role not in STAFF_ROLES:
        raise _forbidden("Staff account required", "AUTH_STAFF_REQUIRED")
    return user


def is_super_admin(user: User) -> bool:
    return user.role == ROLE_SUPER_ADMIN


def is_consultant(user: User) -> bool:
    return user.role == ROLE_CONSULTANT


def can_manage_scholarship(user: User, scholarship: Scholarship) -> bool:
    if is_super_admin(user):
        return True
    return is_consultant(user) and scholarship.owner_id == user.id


def assert_can_manage_scholarship(user: User, scholarship: Scholarship) -> None:
    if not can_manage_scholarship(user, scholarship):
        # Hide existence from consultants who do not own the record.
        raise HTTPException(
            status_code=404,
            detail="Scholarship not found",
            headers={"X-Error-Code": "SCHOLARSHIP_NOT_FOUND"},
        )
