import os

from fastapi import Request

TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true"


def client_ip(request: Request) -> str | None:
    """Return the best-effort client IP.

    When TRUST_PROXY_HEADERS is enabled (deployment sits behind a trusted
    reverse proxy such as the Next.js rewrite or nginx), prefer the first
    X-Forwarded-For value set by the proxy. Otherwise fall back to the direct
    peer address.
    """
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            parts = [part.strip() for part in forwarded.split(",") if part.strip()]
            if parts:
                return parts[0]
    client = request.client
    return client.host if client else None