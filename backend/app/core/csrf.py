import os
import secrets

from fastapi import Request
from fastapi.responses import JSONResponse, Response

CSRF_COOKIE = "csrftoken"
CSRF_HEADER = "X-CSRF-Token"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
CSRF_MAX_AGE = 86400


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def csrf_error_response() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"detail": "CSRF token missing or invalid", "code": "CSRF_FAILED"},
    )


def csrf_token_is_valid(request: Request) -> bool:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header:
        return False
    return secrets.compare_digest(cookie, header)


def response_already_sets_csrf_cookie(response: Response) -> bool:
    headers = getattr(response, "headers", None)
    if not headers:
        return False
    getlist = getattr(headers, "getlist", None) or getattr(headers, "get_all", None)
    if getlist:
        for value in getlist("set-cookie"):
            if value.startswith(f"{CSRF_COOKIE}="):
                return True
        return False
    # fallback
    try:
        for value in headers.get_list("set-cookie"):
            if value.startswith(f"{CSRF_COOKIE}="):
                return True
    except Exception:
        pass
    raw = headers.get("set-cookie", "")
    return f"{CSRF_COOKIE}=" in raw


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=CSRF_MAX_AGE,
        httponly=False,
        secure=os.getenv("APP_ENV") == "production",
        samesite="lax",
        path="/",
    )
