import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import validate_production_config
from app.core.csrf import (
    CSRF_COOKIE,
    UNSAFE_METHODS,
    csrf_token_is_valid,
    new_csrf_token,
    response_already_sets_csrf_cookie,
    set_csrf_cookie,
)
from app.core.deps import get_db
from app.core.ratelimit import limiter, rate_limit_exceeded_handler
from app.routers.admin import router as admin_router
from app.routers.ai import router as ai_router
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router
from app.routers.consultant import router as consultant_router
from app.routers.documents import router as documents_router
from app.routers.notifications import router as notifications_router
from app.routers.onboarding import router as onboarding_router
from app.routers.public import router as public_router
from app.routers.referral import router as referral_router
from app.routers.scholarships import router as scholarships_router
from app.routers.student_data import router as student_data_router
from app.routers.users import router as users_router
from app.routers.visa import router as visa_router

validate_production_config()

app = FastAPI(
    title="Scholario API",
    description="Scholarship discovery and application workspace API.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


@app.middleware("http")
async def csrf_middleware(request: Request, call_next) -> Response:
    webhook = request.url.path.startswith("/api/billing/webhook/")
    if request.method in UNSAFE_METHODS and not webhook and not csrf_token_is_valid(request):
        return JSONResponse(
            status_code=403,
            content={"detail": "CSRF token missing or invalid", "code": "CSRF_FAILED"},
        )
    response = await call_next(request)
    if CSRF_COOKIE not in request.cookies and not response_already_sets_csrf_cookie(response):
        set_csrf_cookie(response, new_csrf_token())
    return response


app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    if os.getenv("APP_ENV") == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(scholarships_router)
app.include_router(student_data_router)
app.include_router(users_router)
app.include_router(notifications_router)
app.include_router(documents_router)
app.include_router(ai_router)
app.include_router(referral_router)
app.include_router(visa_router)
app.include_router(billing_router)
app.include_router(public_router)
app.include_router(admin_router)
app.include_router(consultant_router)


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = (exc.headers or {}).get("X-Error-Code", "REQUEST_ERROR")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "code": code}, headers=exc.headers)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "scholario-api"}


@app.get("/ready", tags=["health"])
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "scholario-api"}


@app.get("/api/health", include_in_schema=False)
def api_health() -> dict[str, str]:
    return health()


@app.get("/api/ready", include_in_schema=False)
def api_ready(db: Session = Depends(get_db)) -> dict[str, str]:
    return ready(db)
