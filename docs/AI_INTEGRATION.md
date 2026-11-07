# AI Integration

AI features use a provider-neutral interface. The advisor, SOP reviewer, text improvement, and scholarship explanation endpoints all call the same configured provider. The deterministic offline mock remains available for local development, tests, and fallback when a remote provider fails.

## Providers

| Provider | `AI_PROVIDER` | Required key | Default model |
| --- | --- | --- | --- |
| Mock (offline) | `mock` | none | deterministic stub |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `gemini-3.6-flash` |

Gemini is called through the native REST API:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{AI_MODEL}:generateContent
```

## Configuration

Set these values in `backend/.env`:

```env
AI_PROVIDER=gemini
AI_MODEL=gemini-3.6-flash
AI_MODEL_FALLBACKS=gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.8-flash
AI_TIMEOUT_SECONDS=30
AI_THINKING_BUDGET=0
AI_FALLBACK_TO_MOCK=true
GEMINI_API_KEY=your-key-here
```

- `AI_MODEL`: use a model available to your key. `gemini-3.6-flash` is the tested default; older models such as `gemini-2.5-flash` may return `404` for new accounts.
- `AI_MODEL_FALLBACKS`: comma-separated models tried when the primary model returns `503`, `504`, or times out. If all models are unavailable, the router falls back to mock when `AI_FALLBACK_TO_MOCK=true`.
- `AI_THINKING_BUDGET`: `0` disables thinking for faster, cheaper responses.
- `AI_FALLBACK_TO_MOCK`: when `true`, provider timeouts, rate limits, and malformed responses fall back to mock output with `provider: "mock-fallback"`. Set to `false` to return HTTP `503` instead.

When running with Docker Compose, the backend loads `backend/.env` through `env_file`. Do not hardcode provider values in `docker-compose.yml`, because Compose variables take precedence over `python-dotenv`.

## Provider interface

`backend/app/services/ai/base.py` defines `AIProvider` with `chat`, `review_sop`, and `improve_text`. Each provider also exposes a `name`. Implementations live under `backend/app/services/ai/`:

- `mock_provider.py` — deterministic offline responses.
- `gemini_provider.py` — Gemini REST adapter with structured JSON output for SOP reviews.

`registry.py` selects the provider from `AI_PROVIDER`. Provider failures raise `AIProviderError`, which the AI router handles with logging and optional mock fallback.

## SOP review format

Gemini returns JSON validated against a response schema with:

```json
{
  "score": 0,
  "sub_scores": {
    "structure": 0,
    "clarity": 0,
    "goals": 0,
    "evidence": 0,
    "grammar": 0,
    "fit": 0
  },
  "strengths": [],
  "issues": [{"quote": "", "problem": "", "suggestion": ""}],
  "rewritten_intro": ""
}
```

Scores are clamped to `0–100`, and missing criteria are filled from the overall score.

## Security and operations

- Keys stay in the backend environment and are never exposed to the browser.
- Never log keys or full student drafts.
- Free-tier Gemini keys are rate-limited. Shared keys can hit `429`; keep mock fallback enabled or enable billing for production.
- Student writing is sent to the external provider. Add a privacy notice and avoid sending sensitive personal data.
- Prompts belong in `prompts.py`; provider calls belong in the provider adapters, not in routers.
