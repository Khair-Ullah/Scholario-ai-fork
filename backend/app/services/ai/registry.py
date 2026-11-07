import os

from app.services.ai.base import AIProvider, AIProviderError
from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.mock_provider import MockProvider


def get_provider(name: str | None = None) -> AIProvider:
    provider = (name or os.getenv("AI_PROVIDER", "mock")).strip().lower()
    if provider == "mock":
        return MockProvider()
    if provider == "gemini":
        return GeminiProvider()
    raise AIProviderError(
        f"AI provider '{provider}' is not configured; select AI_PROVIDER=mock or AI_PROVIDER=gemini"
    )
