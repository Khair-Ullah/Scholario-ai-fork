import json
import os
from typing import Any

import httpx

from app.services.ai.base import AIProvider, AIProviderError
from app.services.ai.prompts import ADVISOR_SYSTEM, IMPROVE_SYSTEM, SOP_REVIEW_SYSTEM

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-3.6-flash"
DEFAULT_MODEL_FALLBACKS = "gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.8-flash"
CRITERIA = ("structure", "clarity", "goals", "evidence", "grammar", "fit")


class _GeminiTransientError(AIProviderError):
    pass

SOP_REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},
        "sub_scores": {
            "type": "object",
            "properties": {name: {"type": "integer"} for name in CRITERIA},
            "required": list(CRITERIA),
        },
        "strengths": {"type": "array", "items": {"type": "string"}},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "quote": {"type": "string"},
                    "problem": {"type": "string"},
                    "suggestion": {"type": "string"},
                },
                "required": ["quote", "problem", "suggestion"],
            },
        },
        "rewritten_intro": {"type": "string"},
    },
    "required": ["score", "sub_scores", "strengths", "issues", "rewritten_intro"],
}


def _clamp_score(value: Any, default: int = 50) -> int:
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, score))


def _normalise_review(data: Any) -> dict:
    if not isinstance(data, dict):
        raise AIProviderError("Gemini returned an invalid review shape")
    raw_sub_scores = data.get("sub_scores")
    sub_scores = raw_sub_scores if isinstance(raw_sub_scores, dict) else {}
    fallback = _clamp_score(data.get("score"))
    normalised = {name: _clamp_score(sub_scores.get(name), fallback) for name in CRITERIA}
    score = _clamp_score(data.get("score"), round(sum(normalised.values()) / len(normalised)))
    raw_strengths = data.get("strengths")
    strengths = (
        [str(item).strip() for item in raw_strengths if str(item).strip()]
        if isinstance(raw_strengths, list)
        else []
    )
    issues = []
    raw_issues = data.get("issues")
    if isinstance(raw_issues, list):
        for item in raw_issues:
            if not isinstance(item, dict):
                continue
            issue = {
                "quote": str(item.get("quote", "")),
                "problem": str(item.get("problem", "")).strip(),
                "suggestion": str(item.get("suggestion", "")).strip(),
            }
            if issue["problem"] or issue["suggestion"]:
                issues.append(issue)
    return {
        "score": score,
        "sub_scores": normalised,
        "strengths": strengths or ["The draft was reviewed by Gemini."],
        "issues": issues,
        "rewritten_intro": str(data.get("rewritten_intro", "")).strip(),
    }


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        primary = os.getenv("AI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
        fallbacks = os.getenv("AI_MODEL_FALLBACKS", DEFAULT_MODEL_FALLBACKS).split(",")
        self.models = []
        for model in [primary, *fallbacks]:
            name = model.strip()
            if name and name not in self.models:
                self.models.append(name)
        try:
            self.timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "30"))
        except ValueError:
            self.timeout = 30.0
        try:
            self.thinking_budget = int(os.getenv("AI_THINKING_BUDGET", "0"))
        except ValueError:
            self.thinking_budget = 0
        if not self.api_key:
            raise AIProviderError("GEMINI_API_KEY is not configured")

    def _request(self, model: str, system: str, prompt: str, schema: dict | None) -> str:
        generation_config: dict[str, Any] = {
            "temperature": 0.4,
            "thinkingConfig": {"thinkingBudget": self.thinking_budget},
        }
        if schema is not None:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseSchema"] = schema
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{API_ROOT}/{model}:generateContent",
                    headers={"x-goog-api-key": self.api_key},
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise _GeminiTransientError(f"Gemini model {model} timed out") from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("Gemini request failed") from exc
        if response.status_code == 429:
            raise AIProviderError("Gemini rate limit reached")
        if response.status_code in {503, 504}:
            raise _GeminiTransientError(f"Gemini model {model} is unavailable (HTTP {response.status_code})")
        if response.status_code >= 400:
            raise AIProviderError(f"Gemini returned HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError as exc:
            raise AIProviderError("Gemini returned an invalid response") from exc
        candidates = data.get("candidates") or []
        if not candidates:
            raise AIProviderError("Gemini returned no candidates")
        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if not text:
            raise AIProviderError("Gemini returned an empty response")
        return text

    def _generate(self, system: str, prompt: str, schema: dict | None = None) -> str:
        last_error: AIProviderError | None = None
        for model in self.models:
            try:
                return self._request(model, system, prompt, schema)
            except _GeminiTransientError as exc:
                last_error = exc
                continue
        raise last_error or AIProviderError("Gemini request failed")

    def chat(self, message: str, scholarships: list[dict]) -> str:
        context = json.dumps(scholarships, ensure_ascii=False, default=str)
        prompt = f"Scholarship records (JSON):\n{context or '[]'}\n\nStudent question: {message}"
        return self._generate(ADVISOR_SYSTEM, prompt)

    def review_sop(self, text: str) -> dict:
        prompt = (
            "Review the following statement of purpose. Return every score as an integer from 0 to 100.\n\n"
            f"{text}"
        )
        raw = self._generate(SOP_REVIEW_SYSTEM, prompt, SOP_REVIEW_SCHEMA)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIProviderError("Gemini returned invalid review JSON") from exc
        return _normalise_review(data)

    def improve_text(self, text: str, instruction: str) -> str:
        prompt = f"Instruction: {instruction or 'clarity and grammar'}\n\nText:\n{text}"
        return self._generate(IMPROVE_SYSTEM, prompt)
