from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, User
from app.services.net import client_ip

SENSITIVE_KEYS = frozenset({"password_hash", "token_hash"})


def _changed(before: dict[str, Any] | None, after: dict[str, Any] | None) -> dict[str, Any] | None:
    if before is None and after is None:
        return None
    if before is None:
        payload = {key: value for key, value in (after or {}).items() if key not in SENSITIVE_KEYS}
        return {"before": None, "after": payload or None}
    if after is None:
        payload = {key: value for key, value in before.items() if key not in SENSITIVE_KEYS}
        return {"before": payload or None, "after": None}
    keys = {key for key in set(before) | set(after) if before.get(key) != after.get(key)}
    keys -= SENSITIVE_KEYS
    if not keys:
        return None
    return {
        "before": {key: before.get(key) for key in keys},
        "after": {key: after.get(key) for key in keys},
    }


def log_audit(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity: str,
    entity_id: str | int | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    ip: str | None = None,
    actor_email: str | None = None,
    commit: bool = False,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_email=actor_email or (actor.email if actor else None),
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        diff=_changed(before, after),
        ip=ip,
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry


def request_ip(request: Any) -> str | None:
    return client_ip(request)
