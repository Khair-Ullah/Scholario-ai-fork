# API

All routes are JSON under `/api`, except `GET /health`. FastAPI interactive docs are at `/docs`; the OpenAPI document is `/openapi.json`.

## Implemented

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| POST | `/api/auth/register` | Create a student and set access/refresh cookies |
| POST | `/api/auth/login` | Student login |
| POST | `/api/auth/admin/login` | Admin-only login |
| POST | `/api/auth/refresh` | Rotate a hashed, persisted refresh token |
| POST | `/api/auth/logout` | Revoke the refresh token, denylist the access token (`jti`), and clear both cookies |
| GET | `/api/auth/me`, `/api/users/me` | Current account and profile |
| PATCH | `/api/users/me` | Update account name/profile preferences |
| POST | `/api/users/me/password` | Change password and revoke refresh tokens |
| DELETE | `/api/users/me` | Delete account and cascaded user data |
| GET/PUT | `/api/onboarding` and `/api/onboarding/step` | Load/autosave onboarding |
| POST | `/api/onboarding/complete` | Finish onboarding |
| GET | `/api/meta/host-countries`, `/api/meta/fields`, `/api/meta/levels`, `/api/meta/countries` | Onboarding choices |
| POST | `/api/tools/gpa-convert` | Convert GPA or marks |
| GET | `/api/scholarships` | Public browse/filter/search/sort/page |
| POST | `/api/scholarships/match` | Authenticated profile matching with facets |
| GET | `/api/scholarships/{id}` | Detail with full source row and apply fallback |
| GET | `/api/scholarships/{id}/similar` | Similar scholarships |
| POST | `/api/scholarships/compare` | Compare up to three IDs |
| GET/POST/DELETE | `/api/saved` and `/api/saved/{scholarship_id}` | User-owned saved scholarships |
| GET/POST/PATCH/DELETE | `/api/applications` and `/api/applications/{id}` | User-owned application tracker |
| GET/POST/PATCH/DELETE | `/api/checklist` and `/api/checklist/{id}` | User-owned checklist items |
| POST | `/api/checklist/generate/{scholarship_id}` | Generate idempotent document/requirement items |
| GET | `/api/templates`, `/api/templates/{slug}` | Template gallery and content |
| GET/POST/PUT/DELETE | `/api/documents` and `/api/documents/{id}` | Private user documents |
| GET | `/api/documents/{id}/versions` | List snapshots |
| POST | `/api/documents/{id}/restore/{version}` | Restore a snapshot |
| POST | `/api/documents/{id}/duplicate` | Duplicate a private draft |
| GET | `/api/documents/{id}/export?format=docx|pdf|txt` | Export owned document |
| GET/POST | `/api/ai/sessions`, `/api/ai/chat` | Persistent mock advisor sessions |
| GET | `/api/ai/sessions/{id}` | Owned session and messages |
| POST | `/api/ai/sop-review`, `/api/ai/improve-text`, `/api/ai/fill-template` | Offline AI stubs |
| POST | `/api/ai/explain-scholarship/{id}`, `/api/ai/eligibility-check` | Record/profile-based helpers |
| GET/PATCH/POST | `/api/notifications`, `/api/notifications/{id}/read`, `/api/notifications/read-all` | User notifications |
| GET | `/api/referral` | Referral code/link and count |
| GET | `/api/visa/{country}` | Static destination guide |
| GET/POST | `/api/billing/plans`, `/api/billing/checkout` | Plan list; checkout explicitly disabled |
| GET | `/api/admin/stats` | Admin dashboard metrics (users, signups/day, top-saved, latest users) |
| GET | `/api/admin/scholarships` | Catalogue list with filters (`q`, `level`, `host_country`, `is_active`, `scholarship_type`, `sort`) and pagination |
| POST | `/api/admin/scholarships` | Create a scholarship listing |
| PATCH | `/api/admin/scholarships/{id}` | Edit any scholarship field (level, IELTS, deadline, type, active) |
| DELETE | `/api/admin/scholarships/{id}` | Delete a listing (409 `SCHOLARSHIP_IN_USE` if referenced) |
| POST | `/api/admin/scholarships/bulk` | Bulk `activate` / `deactivate` / `delete` with per-id results |
| GET | `/api/admin/scholarships/export-csv` | Stream current filters as CSV |
| POST | `/api/admin/scholarships/import-csv`, `…/dry-run` | Import CSV (max 25 MB); dry-run returns preview + validation |
| GET | `/api/admin/data-quality?queue=unmapped\|missing_deadline\|missing_url\|ielts_missing_band` | Counts + paginated rows per data-quality queue |
| GET/PATCH | `/api/admin/universities/{name}/country` | Fix a university→country mapping (existing review endpoint) |
| GET | `/api/admin/users` | Account list with `total`, `role`/`plan`/`is_active` filters, plan counts |
| GET | `/api/admin/users/{id}` | Detail + profile + activity stats |
| PATCH | `/api/admin/users/{id}` | Edit role (admin guards: `SELF_LOCKOUT`, `LAST_ADMIN`), plan, access |
| GET | `/api/admin/users/{id}/sessions`, `…/onboarding` | Session list and onboarding state |
| POST | `/api/admin/users/{id}/revoke-sessions` | Revoke all refresh tokens |
| POST | `/api/admin/users/{id}/reset-onboarding` | Reset onboarding to step one |
| GET/POST | `/api/admin/templates` | List / create document templates |
| GET/PATCH/DELETE | `/api/admin/templates/{id}` | Read / edit / delete a template (delete blocked → 409 `TEMPLATE_IN_USE`) |
| POST | `/api/admin/templates/{id}/reorder` | Reorder templates by `sort_order` |
| POST | `/api/admin/announcements` | Send chunked in-app announcement to `all` / `pro` / `free` → `{delivered}` |
| GET | `/api/admin/announcements` | Past broadcasts with recipient counts |
| GET | `/api/admin/payments` | Plan summary, disabled accounts, activity history |
| POST | `/api/admin/payments/grant` | Manually grant/reset a plan with audit record |
| POST | `/api/admin/payments/transfer` | Approve/reject a payment transfer (recorded until a provider lands) |
| GET/PATCH | `/api/admin/settings` | Read/update `ai_provider`, `flags`, `limits`; `free_results` cap enforced in matching |
| GET | `/api/admin/audit` | Paginated audit log filtered by `actor`, `action`, `entity` with hydrated diffs |
| GET | `/api/admin/ai-stats` | AI usage totals and recent sessions |
| GET | `/api/auth/csrf` | Issue/refresh the double-submit `csrftoken` cookie |

Every document/application/checklist/saved/chat/notification and all `/api/admin/*` routes are scoped to the authenticated owner / administrator. HTTP errors raised by the application use `{ "detail": "...", "code": "..." }`; Pydantic request-validation failures use FastAPI's 422 validation detail. The live OpenAPI schema is authoritative.

## Security

- Mutating requests (`POST/PATCH/PUT/DELETE`) must send the `csrftoken` cookie value in `X-CSRF-Token`; missing/mismatched tokens return `403 {"code":"CSRF_FAILED"}`.
- Sensitive endpoints are rate-limited: `/api/auth/login`+`/api/auth/register` 5/min, `/api/auth/admin/login` 3/min, `/api/ai/*` 20/min, all others 60/min → `429 {"code":"RATE_LIMITED"}`.
- Admin authorization is role-checked server-side (`require_admin`); the client proxy redirects unauthenticated `/admin/*` traffic to `/admin/login`.
- Logout also denylists the presented access token's `jti` (`revoked_access_tokens`, purged at token expiry), so a copied `access_token` is rejected immediately with `401 {"code":"AUTH_REVOKED"}` instead of living out its 30-minute TTL.
- The web client retries a `401` once after a silent `/api/auth/refresh`; if refresh fails it calls `POST /api/auth/logout` to clear cookies (prevents a middleware redirect loop) and navigates to `/login?next=…`, or `/admin/login` on admin routes.
- Sensitive admin actions are captured in the audit log.

## Planned / not enabled

Email verification and password reset, payment webhooks/provider checkout (admin payment actions are logged until the provider arrives), scheduled deadline notifications, and streaming chat are not implemented. Billing checkout returns `503` until a real provider is configured.