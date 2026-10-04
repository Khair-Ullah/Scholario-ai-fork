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
| POST | `/api/auth/logout` | Revoke refresh token and clear cookies |
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
| GET | `/api/admin/stats`, `/api/admin/users`, `/api/admin/scholarships` | Admin summaries and lists |
| PATCH | `/api/admin/users/{id}`, `/api/admin/scholarships/{id}` | Admin account/catalogue edits |
| POST | `/api/admin/scholarships/import-csv` | Admin CSV import, max 25 MB |
| GET/PATCH | `/api/admin/universities/unmapped`, `/api/admin/universities/{name}/country` | Review and fix country mappings |

Every document/application/checklist/saved/chat/notification query is scoped to the authenticated owner. HTTP errors raised by the application use `{ "detail": "...", "code": "..." }`; Pydantic request-validation failures use FastAPI's 422 validation detail. The live OpenAPI schema is authoritative.

## Planned / not enabled

Email verification and password reset, payment webhooks/provider checkout, admin templates/announcements/audit log, scheduled deadline notifications, and streaming chat are not implemented. Billing checkout returns `503` until a real provider is configured.