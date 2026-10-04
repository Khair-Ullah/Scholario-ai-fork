import os

from app.services.ai.base import AIProvider
from app.services.ai.mock_provider import MockProvider


def get_provider() -> AIProvider:
    provider = os.getenv("AI_PROVIDER", "mock").lower()
    if provider == "mock":
        return MockProvider()
    raise RuntimeError(f"AI provider '{provider}' is not configured in this scaffold; select AI_PROVIDER=mock")
