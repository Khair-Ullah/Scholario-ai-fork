# Build Progress

## 2026-10-03

- Step 1 — Added the FastAPI `/health` endpoint and Next.js App Router home screen, Docker Compose, Makefile, environment examples, and documentation skeleton.
- Step 2 — Added scholarship/country schemas, Alembic migrations, CSV cleaning/upsert service, country-map builder, and importer tests. Imported all 9,338 source rows locally.
- Step 3 — Added student/admin registration and login, signed access/refresh tokens, hashed refresh-token persistence/rotation, admin bootstrap, account/profile endpoints, and auth tests.
- Step 4 — Added GPA conversion, the IELTS/GPA tier matcher, onboarding persistence, metadata/GPA/match APIs, and the required matching tests.
- Step 5 — Added public scholarship browsing, detail, similar, compare, and admin catalogue APIs.
- Step 6 — Added Next.js design base, shared student navigation, auth screens, typed API client, and protected route proxy.
- Step 7 — Added a ten-step autosaving onboarding wizard, profile GPA inputs, and review/finish flow.
- Step 8 — Added matched results, sorting/search, chance indicators, and pagination.
- Step 9 — Added scholarship details and official-link search fallback.
- Step 10 — Added saved scholarships, application tracker, checklist generation, and per-user notifications.
- Step 11 — Added eight seeded templates, TipTap editing, private documents, version history/restore, autosave, duplicate/delete, and DOCX/PDF/TXT export.
- Step 12 — Added offline mock advisor, persisted private chat, SOP feedback, text improvement, and safe template filling.
- Step 13 — Added profile/preferences, referral stats, visa guide pages, and a disabled billing skeleton.
- Step 14 — Added protected admin sign-in, dashboard, catalogue edits/import, country review, and user plan/access management.
- Step 15 — Rebuilt a responsive public landing experience and added metadata. Lighthouse/SEO audit remains.
- Step 16 — Backend unit/integration tests cover auth, import, matching, docs, AI, admin, and student-data ownership. CI workflow added; coverage is 81.37%; Playwright smoke test remains.
- Step 17 — Added project documentation stubs and current decisions/progress. Deployment/payment/AI docs need production-specific review.
- The canonical scholarship CSV is staged under `backend/data/`; legacy prototype HTML lives in `frontend/prototype/` and is not part of the new runtime application.
- Validation: 43 backend tests pass; services coverage measured 81.37%; Ruff and ESLint pass; Next.js 16 production build passes; production npm audit reports 0 vulnerabilities. Docker Compose has since been verified end to end on a Docker Desktop host: both services start, `/health` responds, Alembic reaches head, and the CSV import reproduces the documented counts below.
- Step 18 — Fixed the local Compose setup: removed the shadowed duplicate `/data` mount (named volume now at `/data/db`, CSV bind mount stays at `/data`), moved Alembic and template seeding into the backend command so a fresh clone migrates on start, replaced the Makefile's host-only Python targets with `docker compose exec` equivalents, pinned `python-dotenv` explicitly instead of relying on it arriving transitively through `pydantic-settings`, and gave the pip layer a 300s timeout with retries plus a kept cache so slow networks no longer fail the image build. Added `backend/.dockerignore` and `frontend/.dockerignore`, which cut the frontend build context from 264 MB to a few MB.
- Data: source has 53 columns and 9,338 rows; country map covers all 844 university names, with 600 provider names left Unknown (3,041 scholarship rows) for admin review. SQLite import is repeatable and preserves DB country corrections.
- Known gaps: eight of the requested 30 templates are seeded; several admin features (announcements, payment management, template management, audit log) and student billing/referral rewards remain skeletons; email verification/reset, refresh-cookie CSRF protection, notification scheduling, and Playwright/Lighthouse gates are not implemented.
- Step 19 — Repository reorganization: moved the 23 legacy prototype pages plus `auth-client.js` and `SM_TAB.png` into `frontend/prototype/`, moved `data/` into `backend/data/`, and moved `prompt.txt` into `docs/`. Removed duplicate/junk artifacts (root CSV duplicates, `scholarships_database.db`, `structured_database_scholarships.csv`, empty HTTrack `package-lock.json`, `package-lock (copy 1).json`, `tsconfig.tsbuildinfo`, `.coverage`). Updated the paths that depended on the old layout: the Compose `/data` bind mount, `build_country_map.py`, `import_csv.py`'s default country-map path, the admin import fallback directory, `.gitignore`, `frontend/.dockerignore`, ESLint ignores, and the affected README/docs references. Runtime code (matching, auth, AI, routers, components) is unchanged.
- Next: finish the remaining admin/payment/template breadth, Playwright and Lighthouse gates, and production-readiness review.