import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scholario.db")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

SEVEN_PLUS_SEES_ALL = os.getenv("SEVEN_PLUS_SEES_ALL", "false").lower() == "true"

GPA_THRESHOLDS = {
    "Undergraduate": (3.0, 3.5),
    "Master": (3.2, 3.6),
    "PhD": (3.4, 3.7),
}

LOCAL_HOSTS = ("localhost", "127.0.0.1", "0.0.0.0")
POSTGRES_SCHEMES = ("postgresql://", "postgresql+psycopg://")


def validate_production_config() -> None:
    if os.getenv("APP_ENV", "development") != "production":
        return

    errors: list[str] = []
    secret_key = os.getenv("SECRET_KEY", "")
    if len(secret_key) < 32:
        errors.append("SECRET_KEY must be at least 32 random characters")

    database_url = os.getenv("DATABASE_URL", "")
    if not database_url.startswith(POSTGRES_SCHEMES):
        errors.append("DATABASE_URL must be a PostgreSQL URL")

    origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "").split(",") if origin.strip()]
    if not origins:
        errors.append("FRONTEND_ORIGINS must contain the public frontend origin")
    elif any(any(host in origin for host in LOCAL_HOSTS) for origin in origins):
        errors.append("FRONTEND_ORIGINS must not contain localhost addresses in production")

    frontend_base = os.getenv("FRONTEND_BASE_URL", "")
    if not frontend_base.startswith("https://"):
        errors.append("FRONTEND_BASE_URL must be the public HTTPS frontend URL")

    if errors:
        raise RuntimeError("Invalid production configuration: " + "; ".join(errors))
