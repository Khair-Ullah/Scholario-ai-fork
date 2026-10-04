import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers.admin import router as admin_router
from app.routers.ai import router as ai_router
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router
from app.routers.documents import router as documents_router
from app.routers.notifications import router as notifications_router
from app.routers.onboarding import router as onboarding_router
from app.routers.referral import router as referral_router
from app.routers.scholarships import router as scholarships_router
from app.routers.student_data import router as student_data_router
from app.routers.users import router as users_router
from app.routers.visa import router as visa_router

app = FastAPI(
    title="Scholario API",
    description="Scholarship discovery and application workspace API.",
    version="0.1.0",
)

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
app.include_router(admin_router)


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = (exc.headers or {}).get("X-Error-Code", "REQUEST_ERROR")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "code": code}, headers=exc.headers)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "scholario-api"}
