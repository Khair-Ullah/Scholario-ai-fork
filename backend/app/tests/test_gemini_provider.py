import json

import pytest

from app.services.ai import gemini_provider
from app.services.ai.base import AIProviderError
from app.services.ai.gemini_provider import GeminiProvider, _normalise_review
from app.services.ai.mock_provider import MockProvider
from app.services.ai.registry import get_provider


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}

    def json(self) -> dict:
        return self._payload


class FakeClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.requests: list[tuple[str, dict, dict]] = []

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *args: object) -> bool:
        return False

    def post(self, url: str, headers: dict | None = None, json: dict | None = None) -> FakeResponse:
        self.requests.append((url, headers or {}, json or {}))
        return self.response


class SequenceClient(FakeClient):
    def __init__(self, responses: list[FakeResponse]) -> None:
        self.responses = responses
        self.requests: list[tuple[str, dict, dict]] = []

    def post(self, url: str, headers: dict | None = None, json: dict | None = None) -> FakeResponse:
        self.requests.append((url, headers or {}, json or {}))
        return self.responses.pop(0)


def make_provider(monkeypatch, response: FakeResponse) -> tuple[GeminiProvider, FakeClient]:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("AI_MODEL", "gemini-3.6-flash")
    monkeypatch.setenv("AI_MODEL_FALLBACKS", "")
    monkeypatch.setenv("AI_THINKING_BUDGET", "0")
    provider = GeminiProvider()
    client = FakeClient(response)
    monkeypatch.setattr(gemini_provider.httpx, "Client", lambda timeout: client)
    return provider, client


def candidate(text: str) -> FakeResponse:
    return FakeResponse(payload={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def test_chat_extracts_text_and_sends_scholarship_context(monkeypatch) -> None:
    provider, client = make_provider(monkeypatch, candidate("The deadline is 19 Mar 2027."))
    answer = provider.chat("When is the deadline?", [{"title": "Example Award"}])
    assert answer == "The deadline is 19 Mar 2027."
    assert "When is the deadline?" in client.requests[0][2]["contents"][0]["parts"][0]["text"]
    assert "Example Award" in client.requests[0][2]["contents"][0]["parts"][0]["text"]


def test_review_sop_parses_structured_json(monkeypatch) -> None:
    body = {
        "score": 88,
        "sub_scores": {
            "structure": 80,
            "clarity": 85,
            "goals": 90,
            "evidence": 88,
            "grammar": 80,
            "fit": 95,
        },
        "strengths": ["Clear motivation"],
        "issues": [{"quote": "I want to study", "problem": "Vague opening", "suggestion": "Name a specific moment."}],
        "rewritten_intro": "A specific academic moment introduced my interest.",
    }
    provider, client = make_provider(monkeypatch, candidate(json.dumps(body)))
    result = provider.review_sop("My draft")
    assert result["score"] == 88
    assert result["sub_scores"]["grammar"] == 80
    assert result["issues"][0]["problem"] == "Vague opening"
    assert client.requests[0][2]["generationConfig"]["responseMimeType"] == "application/json"
    assert client.requests[0][2]["generationConfig"]["responseSchema"] is not None


def test_rate_limit_raises_provider_error(monkeypatch) -> None:
    provider, _ = make_provider(monkeypatch, FakeResponse(status_code=429))
    with pytest.raises(AIProviderError, match="rate limit"):
        provider.chat("Hello", [])


def test_invalid_review_json_raises_provider_error(monkeypatch) -> None:
    provider, _ = make_provider(monkeypatch, candidate("not-json"))
    with pytest.raises(AIProviderError, match="invalid review JSON"):
        provider.review_sop("My draft")


def test_normalise_review_clamps_scores_and_fills_missing_criteria() -> None:
    result = _normalise_review(
        {"score": 120, "sub_scores": {"structure": -5}, "strengths": [], "issues": [], "rewritten_intro": ""}
    )
    assert result["score"] == 100
    assert result["sub_scores"]["structure"] == 0
    assert set(result["sub_scores"]) == {"structure", "clarity", "goals", "evidence", "grammar", "fit"}


def test_generate_falls_back_to_next_model_on_503(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("AI_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("AI_MODEL_FALLBACKS", "gemini-3.6-flash")
    provider = GeminiProvider()
    client = SequenceClient([FakeResponse(status_code=503), candidate("OK")])
    monkeypatch.setattr(gemini_provider.httpx, "Client", lambda timeout: client)
    assert provider.chat("Hello", []) == "OK"
    assert "gemini-3.8-flash" in client.requests[0][0]
    assert "gemini-3.6-flash" in client.requests[1][0]


def test_generate_raises_when_all_models_are_unavailable(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("AI_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("AI_MODEL_FALLBACKS", "gemini-3.6-flash")
    provider = GeminiProvider()
    client = SequenceClient([FakeResponse(status_code=503), FakeResponse(status_code=503)])
    monkeypatch.setattr(gemini_provider.httpx, "Client", lambda timeout: client)
    with pytest.raises(AIProviderError, match="unavailable"):
        provider.chat("Hello", [])


def test_registry_selects_gemini(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    assert isinstance(get_provider(), GeminiProvider)


def test_registry_selects_mock(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "mock")
    assert isinstance(get_provider(), MockProvider)
