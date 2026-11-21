# Build Progress

## 2026-10-03

- Step 1  -  Added the FastAPI `/health` endpoint and Next.js App Router home screen, Docker Compose, Makefile, environment examples, and documentation skeleton.
- Step 2  -  Added scholarship/country schemas, Alembic migrations, CSV cleaning/upsert service, country-map builder, and importer tests. Imported all 9,338 source rows locally.
- Step 3  -  Added student/admin registration and login, signed access/refresh tokens, hashed refresh-token persistence/rotation, admin bootstrap, account/profile endpoints, and auth tests.
- Step 4  -  Added GPA conversion, the IELTS/GPA tier matcher, onboarding persistence, metadata/GPA/match APIs, and the required matching tests.
- Step 5  -  Added public scholarship browsing, detail, similar, compare, and admin catalogue APIs.
- Step 6  -  Added Next.js design base, shared student navigation, auth screens, typed API client, and protected route proxy.
- Step 7  -  Added a ten-step autosaving onboarding wizard, profile GPA inputs, and review/finish flow.
- Step 8  -  Added matched results, sorting/search, chance indicators, and pagination.
- Step 9  -  Added scholarship details and official-link search fallback.
- Step 10  -  Added saved scholarships, application tracker, checklist generation, and per-user notifications.
- Step 11  -  Added eight seeded templates, TipTap editing, private documents, version history/restore, autosave, duplicate/delete, and DOCX/PDF/TXT export.
- Step 12  -  Added offline mock advisor, persisted private chat, SOP feedback, text improvement, and safe template filling.
- Step 13  -  Added profile/preferences, referral stats, visa guide pages, and a disabled billing skeleton.
- Step 14  -  Added protected admin sign-in, dashboard, catalogue edits/import, country review, and user plan/access management.
- Step 15  -  Rebuilt a responsive public landing experience and added metadata. Lighthouse/SEO audit remains.
- Step 16  -  Backend unit/integration tests cover auth, import, matching, docs, AI, admin, and student-data ownership. CI workflow added; coverage is 81.37%; Playwright smoke test remains.
- Step 17  -  Added project documentation stubs and current decisions/progress. Deployment/payment/AI docs need production-specific review.
- The canonical scholarship CSV is staged under `backend/data/`; legacy prototype HTML lives in `frontend/prototype/` and is not part of the new runtime application.
- Validation: 43 backend tests pass; services coverage measured 81.37%; Ruff and ESLint pass; Next.js 16 production build passes; production npm audit reports 0 vulnerabilities. Docker Compose has since been verified end to end on a Docker Desktop host: both services start, `/health` responds, Alembic reaches head, and the CSV import reproduces the documented counts below.
- Step 18  -  Fixed the local Compose setup: removed the shadowed duplicate `/data` mount (named volume now at `/data/db`, CSV bind mount stays at `/data`), moved Alembic and template seeding into the backend command so a fresh clone migrates on start, replaced the Makefile's host-only Python targets with `docker compose exec` equivalents, pinned `python-dotenv` explicitly instead of relying on it arriving transitively through `pydantic-settings`, and gave the pip layer a 300s timeout with retries plus a kept cache so slow networks no longer fail the image build. Added `backend/.dockerignore` and `frontend/.dockerignore`, which cut the frontend build context from 264 MB to a few MB.
- Data: source has 53 columns and 9,338 rows; country map covers all 844 university names, with 600 provider names left Unknown (3,041 scholarship rows) for admin review. SQLite import is repeatable and preserves DB country corrections.
- Known gaps: eight of the requested 30 templates are seeded; several admin features (announcements, payment management, template management, audit log) and student billing/referral rewards remain skeletons; email verification/reset, refresh-cookie CSRF protection, notification scheduling, and Playwright/Lighthouse gates are not implemented.
- Step 19  -  Repository reorganization: moved the 23 legacy prototype pages plus `auth-client.js` and `SM_TAB.png` into `frontend/prototype/`, moved `data/` into `backend/data/`, and moved `prompt.txt` into `docs/`. Removed duplicate/junk artifacts (root CSV duplicates, `scholarships_database.db`, `structured_database_scholarships.csv`, empty HTTrack `package-lock.json`, `package-lock (copy 1).json`, `tsconfig.tsbuildinfo`, `.coverage`). Updated the paths that depended on the old layout: the Compose `/data` bind mount, `build_country_map.py`, `import_csv.py`'s default country-map path, the admin import fallback directory, `.gitignore`, `frontend/.dockerignore`, ESLint ignores, and the affected README/docs references. Runtime code (matching, auth, AI, routers, components) is unchanged.
- Next: finish the remaining admin/payment/template breadth, Playwright and Lighthouse gates, and production-readiness review.

## 2026-10-08

- Step 20  -  Closed the two logout gaps found in the auth review. Backend: added the `revoked_access_tokens` denylist (model + migration `0010_access_token_denylist`), `app/services/token_blocklist.py`, a `jti` check in `get_current_user` (`401 AUTH_REVOKED`), and logout now denylists the presented access token alongside the refresh-token revocation and cookie clearing; expired denylist rows are purged on each logout. Frontend: `api.ts` gained `endSession()`  -  when a silent refresh fails it calls `/api/auth/logout` to clear the cookies (avoids a middleware redirect loop) and then redirects to `/login?next=...`, or `/admin/login` on admin routes, guarded by a `sessionStorage` flag so it happens once per expiry and any later successful response re-arms it.
- Validation: `ruff check` clean; pytest 70 passed with the new `test_logout_revokes_stolen_access_token`, services coverage 81.28%; ESLint and `tsc --noEmit` clean. Live smoke against Compose: stolen Bearer token answers `200` before logout and `401 AUTH_REVOKED` after it. Docs updated: `docs/API.md`, `docs/REQUIREMENTS.md` (FR-004 + v1.1), `docs/DECISIONS.md`, README progress, blueprint §8.

## 2026-10-10

- Step 21  -  Split administration into roles and added a consultant workspace. Roles are now `student`, `consultant`, and `super_admin` (migration `0011_roles_ownership_2fa` maps legacy `admin` -> `super_admin`, adds user TOTP columns, `scholarships.owner_id`, `auth_attempts`, and `consultant_warnings`). `app/core/permissions.py` centralises the gates; the existing `/admin` panel requires `super_admin` and a new `/consultant` panel requires `consultant`. Consultants manage only the scholarships they own (`owner_id`), while super admins manage everything and can reassign ownership. Staff sign-in gains optional TOTP two-factor (`pyotp`, hashed recovery codes, `/api/auth/mfa/*`) and a 5-failures/15-minute login lockout driven by `auth_attempts`. Suspicious consultant activity (delete/edit/import bursts) raises deduplicated warnings via `app/services/anomaly.py`, shown to the consultant and manageable by super admins. New frontend: super-admin Consultants + Warnings pages and an MFA panel; a full `/consultant` workspace (login, dashboard, scholarships, applicants, warnings, profile). New script `scripts/create_consultant.py` + `make seed-consultant`.
- Validation: `ruff check` clean; full suite 79 passed (new `test_consultant.py` covers role gates, ownership isolation and reassignment, warn+acknowledge, 2FA login, lockout, and anomaly dedupe), services coverage 82.67% (≥80%); ESLint, `tsc --noEmit`, and `next build` clean. Docker (Python 3.12) re-validated: backend image rebuilt with `pyotp`, container healthy on `:8000`, pytest 79 passed / 82.67%, frontend lint + build pass in a throwaway container, migration at head `0011_roles_ownership_2fa`, and a live smoke confirmed role enforcement (consultant  ->  `/api/admin/*` 403 `AUTH_FORBIDDEN` and `/api/consultant/*` 200; super admin the reverse). Docs updated: `docs/API.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/ADMIN_PANEL_BLUEPRINT.md` (M5 + §8), `docs/REQUIREMENTS.md`, `docs/DEPLOYMENT.md`, README.
- Local run note: when the frontend runs on the host with `npm run dev`, start only the backend container (`make up-backend` / `docker compose up -d backend`) to avoid the port-3000 conflict (`ports are not available`). Added the `up-backend` Makefile target and switched `test-frontend` to `docker compose run --rm --no-deps` so frontend lint/build work even while a host dev server holds port 3000.
- Known gaps: consultant CSV import is not implemented (owned CSV export is); 2FA is optional for staff (not forced for super admins).

## 2026-11-20

- Step 22  -  Created and verified the production super admin:
  - Command: `docker compose exec -T backend python -m scripts.create_admin --email ku6441544@gmail.com --password '<strong-password>'`.
  - DB check: `ku6441544@gmail.com | super_admin | active=True | verified=True | plan=pro`.
  - The password is intentionally not recorded in this file.
- Step 23  -  Fixed the admin panel logout/console-error issue.
  - Symptoms reported: clicking Admin logged out; browser logs showed `ERR_CONNECTION_TIMED_OUT`, `Cannot find menu item with id save-page`, `AbortError` from play/pause, `/api/auth/admin/login` 500 then 429.
  - Root causes found:
    - Admin/consultant layouts redirected to login on *any* `getMe()` failure (`429`, `500`, network), so a transient failure looked like logout.
    - `apiFetch` ended the session whenever silent refresh failed, including non-auth failures.
    - Backend `/api/notifications` returned 500 with `PydanticSerializationError: Unable to serialize unknown type: <class 'app.models.notification.Notification'>`.
    - Next.js proxy made all requests share one IP; default `60/minute` limit caused 429s. `TRUST_PROXY_HEADERS=false` also meant per-client limits were ineffective.
    - `Failed to proxy http://backend:8000/api/auth/admin/login Error: socket hang up / ECONNRESET` was transient during a backend restart, not a code defect.
    - `save-page` and `play()/pause()` errors were not present in repo code; likely browser-extension noise.
  - Fixes applied:
    - `frontend/src/lib/api.ts`: added `AUTH_ERROR_CODES` + `isAuthError`; `refreshSession()` now returns the status code and only ends the session on `401`/`403`, otherwise throws `ApiError("The service is temporarily unavailable. Please try again.", status || 503)`.
    - `frontend/src/app/admin/layout.tsx` and `frontend/src/app/consultant/layout.tsx`: only redirect on real auth errors; transient failures now show an error card with a "Try again" button.
    - `backend/app/core/ratelimit.py`: default limit raised to `600/minute`.
    - `docker-compose.yml`: `TRUST_PROXY_HEADERS: "true"` added to backend environment.
    - `backend/app/routers/notifications.py`: ORM notifications are serialized to dicts before response validation.
    - `backend/app/tests/test_student_data.py`: added `test_notifications_endpoint_returns_serialized_items`.
    - `backend/app/tests/test_email.py`: added 4 SMTP mock tests so service coverage stays above the 80% gate.
  - Verification at this stage: Ruff clean, 96 backend tests passed, ESLint/TypeScript/build passed, and smoke via `http://localhost:3000` returned `login=200 role=super_admin notifications=200`.
- Step 24  -  Prepared the deployment target after the user asked for a careful Vercel deployment and delegated backend/keys/domain decisions ("aap khud decide karo").
  - Decision: **Vercel frontend + Railway FastAPI + Railway/managed Postgres**. Real domain and secrets were not provided, so placeholders are used in docs/templates only; nothing secret was committed.
  - Architecture: browser calls same-origin `/api/*` on Vercel → Vercel rewrite → Railway `/api/*`. `NEXT_PUBLIC_API_URL` must be empty; `BACKEND_URL` must be the public Railway origin and is embedded at build time. This keeps auth cookies host-only and avoids cross-site cookie/CORS problems.
  - New/changed deployment files:
    - `frontend/vercel.json`: framework `nextjs`, `npm ci`, `npm run build`.
    - `frontend/next.config.mjs`: validates on Vercel that `BACKEND_URL` is set/non-local and `NEXT_PUBLIC_API_URL` is empty; strips trailing slash from the rewrite destination.
    - `backend/Dockerfile.railway`: Python `3.12.16-slim`, installs pinned `requirements.prod.txt`, non-root `appuser`, honors `$PORT`.
    - `backend/requirements.prod.txt`: pinned production subset generated from the verified container environment.
    - `backend/railway.toml`: Dockerfile builder, pre-deploy `alembic upgrade head` + `scripts.seed_templates`, `startCommand` using `$PORT`, `/ready` healthcheck, restart policy.
    - `backend/app/core/config.py`: added `validate_production_config()` (`APP_ENV=production` requires strong `SECRET_KEY`, PostgreSQL `DATABASE_URL`, non-local HTTPS `FRONTEND_ORIGINS`/`FRONTEND_BASE_URL`) and normalized Railway's `postgresql://` to `postgresql+psycopg://`.
    - `backend/app/main.py`: calls the validator at import time; added root `/ready` with `SELECT 1` and proxied aliases `/api/health` + `/api/ready`.
    - `backend/app/tests/test_production_config.py`: 7 tests for validation skip/accept/reject cases.
    - `backend/app/tests/test_student_data.py`: added `/ready` and `/api/health` + `/api/ready` alias tests.
    - `backend/.env.example`, `frontend/.env.example`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md`, `DEPLOY_CHECKLIST.md`: updated with the selected target, env inventory, verification commands, rollback, and honest remaining gates.
  - Railway Config-as-Code is deprecated (supported until 2026-12-01); docs instruct verifying/moving settings into the dashboard before final launch.
  - `docker-compose.yml` remains development-only; production no longer depends on a prod Compose file.
- Step 25  -  Final verification and local state:
  - `docker compose exec backend python -m ruff check app scripts alembic` → `All checks passed!`.
  - `docker compose exec backend python -m pytest --cov=app.services --cov-fail-under=80 -q` → **109 passed**, service coverage **83.51%**.
  - `npm run lint`, `npm run build` in `frontend/` → pass. Host build used `$env:BACKEND_URL='http://backend:8000'; $env:NEXT_PUBLIC_API_URL=''`.
  - Vercel guard checked both ways: missing `BACKEND_URL` throws; `BACKEND_URL=https://api.example.com/` produces `https://api.example.com/api/:path*`.
  - Production config checked both ways: Railway-style env loads and normalizes `postgresql://` → `postgresql+psycopg://`; short secret/local origins fail fast with `Invalid production configuration`.
  - `railway.toml` parsed with `tomllib`; `vercel.json` parsed with Node JSON.
  - Local smoke via `http://localhost:3000`: `health=200`, `ready={"status":"ready","service":"scholario-api"}`, `login=200`, `role=super_admin`, `notifications=200`.
  - Local containers are healthy, but the frontend image was **not rebuilt** because `docker compose up -d --build` failed with Docker Hub auth timeout (`failed to fetch anonymous token ... dial tcp 104.18.43.178:443: i/o timeout`). Workaround: host-built `.next` was copied into the frontend container and the container restarted. A real image rebuild is still pending.
  - `DEPLOY_CHECKLIST.md` status remains **NOT READY for public production**: real domain/TLS, platform secrets, Stripe/Google/SMTP/AI smoke tests, Redis-backed rate limiting, Sentry/observability, backup/restore drill, Postgres CI job, Playwright/Lighthouse, audits, legal/support/on-call, staff MFA enforcement, and explicit launch approval are still open.
  - Pre-existing unrelated working-tree changes (`.gitignore`, `README.md`, deleted PDFs, `frontend/Dockerfile`, `docs/materials/`, etc.) were left untouched; no commit was made.
- Next: user dashboard work can start from this saved state.