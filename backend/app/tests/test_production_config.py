import pytest

from app.core.config import validate_production_config


def _valid_env(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "a" * 48)
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@db:5432/scholario")
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://scholario.ai")
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://scholario.ai")


def test_validation_skips_non_production(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    validate_production_config()


def test_validation_accepts_complete_production_env(monkeypatch) -> None:
    _valid_env(monkeypatch)
    validate_production_config()


@pytest.mark.parametrize(
    ("variable", "value", "message"),
    [
        ("SECRET_KEY", "short", "SECRET_KEY"),
        ("DATABASE_URL", "sqlite:///local.db", "DATABASE_URL"),
        ("FRONTEND_ORIGINS", "http://localhost:3000", "FRONTEND_ORIGINS"),
        ("FRONTEND_BASE_URL", "http://scholario.ai", "FRONTEND_BASE_URL"),
    ],
)
def test_validation_rejects_bad_production_env(monkeypatch, variable: str, value: str, message: str) -> None:
    _valid_env(monkeypatch)
    monkeypatch.setenv(variable, value)
    with pytest.raises(RuntimeError, match=message):
        validate_production_config()
