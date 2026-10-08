import os
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Setting

DEFAULT_SETTINGS: dict[str, Any] = {
    "ai_provider": os.getenv("AI_PROVIDER", "mock"),
    "flags": {
        "registration_enabled": True,
        "ai_enabled": True,
        "announcements_enabled": True,
    },
    "limits": {
        "free_results": 30,
        "pro_results": 100,
        "free_documents": 5,
    },
}


def _merge(defaults: dict[str, Any], stored: Any) -> dict[str, Any]:
    stored = stored if isinstance(stored, dict) else {}
    merged: dict[str, Any] = {}
    for key, value in defaults.items():
        if isinstance(value, dict):
            merged[key] = _merge(value, stored.get(key))
        else:
            merged[key] = stored.get(key, value)
    for key, value in stored.items():
        if key not in merged:
            merged[key] = value
    return merged


def get_settings(db: Session) -> dict[str, Any]:
    rows = {row.key: row.value for row in db.scalars(select(Setting)).all()}
    return _merge(DEFAULT_SETTINGS, rows)


def save_settings(db: Session, payload: dict[str, Any], commit: bool = True) -> dict[str, Any]:
    current = get_settings(db)
    for key, value in payload.items():
        if key in ("flags", "limits") and isinstance(value, dict):
            current[key] = {**current.get(key, {}), **value}
        elif key in DEFAULT_SETTINGS:
            current[key] = value
    for key, value in current.items():
        row = db.get(Setting, key)
        if row is None:
            db.add(Setting(key=key, value=value))
        else:
            row.value = value
    if commit:
        db.commit()
    return current


def free_result_limit(db: Session) -> int:
    limits = get_settings(db).get("limits", {})
    try:
        return max(1, int(limits.get("free_results", 30)))
    except (TypeError, ValueError):
        return 30
