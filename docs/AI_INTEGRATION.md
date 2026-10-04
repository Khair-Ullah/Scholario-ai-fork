# AI Integration

AI features use a provider-neutral interface and default to a deterministic offline mock. The mock must use retrieved scholarship records and clearly identify demo responses. It must not invent opportunities, guarantee admission, or help forge credentials.

Planned adapter methods include chat, SOP review, text improvement, template filling, scholarship explanation, eligibility checks, and country classification. HTTP provider credentials belong in `backend/.env`; provider implementations live under `backend/app/services/ai/`. Prompts belong in one editable prompts module. Per-user quotas and usage accounting are enforced by the API, not the browser.

To connect a provider: add its key to the backend environment, implement the provider adapter's API call, select it with `AI_PROVIDER`, and test timeout/error fallbacks. The mock must remain available for local and offline operation.