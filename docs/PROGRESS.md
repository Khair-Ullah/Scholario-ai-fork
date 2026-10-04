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
- The canonical scholarship CSV is staged under `data/`; root-level HTML is not part of the new runtime application.
- Validation: 43 backend tests pass; services coverage measured 81.37%; Ruff and ESLint pass; Next.js 16 production build passes; production npm audit reports 0 vulnerabilities. Docker Compose YAML parses, but Compose itself cannot run because this environment has Docker Engine without the Compose CLI.
- Data: source has 53 columns and 9,338 rows; country map covers all 844 university names, with 600 provider names left Unknown (3,041 scholarship rows) for admin review. SQLite import is repeatable and preserves DB country corrections.
- Known gaps: eight of the requested 30 templates are seeded; several admin features (announcements, payment management, template management, audit log) and student billing/referral rewards remain skeletons; email verification/reset, refresh-cookie CSRF protection, notification scheduling, and Playwright/Lighthouse gates are not implemented.
- Next: finish the remaining admin/payment/template breadth, Playwright and Lighthouse gates, and production-readiness review.