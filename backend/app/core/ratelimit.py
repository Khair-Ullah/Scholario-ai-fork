from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.services.net import client_ip


def _rate_limit_key(request: Request) -> str:
    return client_ip(request) or "unknown"


limiter = Limiter(key_func=_rate_limit_key, default_limits=["600/minute"])


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again shortly.", "code": "RATE_LIMITED"},
    )
