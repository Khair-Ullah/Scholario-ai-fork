# Scholario — Frontend Plan Worklog

> Companion to `plan_fornt.md`. **This is the single source of truth for "what
> is done" and "what is left".** Update it after every work block. If a session
> stops or the agent context is lost, read this file first, then `plan_fornt.md`.
>
> Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked/needs
> decision or credentials · `[-]` intentionally deferred

---

## Resume here (next action)

> **Next:** credentials + smoke tests. Docker is running; phases 1–4 are live and
> backend checks pass.
>
> **Full setup guide:** [`docs/SETUP_GOOGLE_EMAIL_STRIPE.md`](docs/SETUP_GOOGLE_EMAIL_STRIPE.md)
> covers Google OAuth, SMTP password-reset email, and Stripe test/live setup with
> exact env vars and commands.
>
> Remaining:
>
> 1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`,
>    SMTP vars, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` as described in the guide.
> 2. Rebuild/recreate the affected containers:
>
>    ```bash
>    docker compose up -d --build frontend
>    docker compose up -d --force-recreate backend
>    ```
>
> 3. Smoke-test checkout + Google sign-in and record the result below.
>
> Frontend now runs as a **production build** in Docker (`npm start`), not
> `next dev`; Windows bind-mount dev compile took ~2.5 min per route. Migration
> `0013_accounts_payments` is applied, and `/api/public/stats` +
> `/api/public/featured` are cached for 120 s.
>
> After each item below, tick it and add a dated line under "Session log".

---

## Status by phase

### Phase 0 — Planning docs
- [x] Write `plan_fornt.md` (landing, accounts, Google, Stripe).
- [x] Write `plan_fornt_worklog.md` (this file).

### Phase 1 — Landing page & public trust
- [x] Backend: `GET /api/public/stats` (active scholarships, universities,
      countries).
- [x] Backend: `GET /api/public/featured` (3 active opportunities).
- [x] Frontend: `src/lib/serverApi.ts` safe server fetch with fallback.
- [x] Frontend: `PublicHeader` + `PublicFooter` components.
- [x] Frontend: rewrite `src/app/page.tsx` with plan §2 sections.
- [x] Frontend: landing CSS (prefixed `lp-`) in `globals.css`.
- [x] Frontend: legal pages — `/privacy`, `/terms`, `/refund-policy`, `/contact`.
- [x] Verified: landing renders without backend; counters/featured degrade safely.

### Phase 2 — Account lifecycle
- [x] Backend: `AuthToken` model (generic purpose/token roles) + migration
      `0013_accounts_payments`.
- [x] Backend: `app/services/email.py` (SMTP + console stub).
- [x] Backend: `POST /api/auth/forgot-password` (generic response, hashed token,
      30 min expiry, rate-limited).
- [x] Backend: `POST /api/auth/reset-password` (single-use, revokes sessions).
- [x] Backend schemas for forgot/reset.
- [x] Frontend: `/forgot-password` page.
- [x] Frontend: `/reset-password` page.
- [x] Frontend: login page — show/hide password + forgot link.
- [x] Frontend: register page — confirm password, strength, terms consent.
- [-] (Deferred) Email verification enforcement behind a flag.

### Phase 3 — Google sign-in/up
- [x] Backend: `users.google_sub` column + migration.
- [x] Backend: `POST /api/auth/google` (verify tokeninfo, upsert, session).
- [x] Backend: config/env for `GOOGLE_CLIENT_ID`.
- [x] Frontend: `GoogleButton` component (GIS) on login + register.
- [x] Verified: hidden/disabled when not configured; 503 from API.

### Phase 4 — Stripe payments
- [x] Backend: `Payment` model + migration.
- [x] Backend: `POST /api/billing/checkout` (Stripe Checkout Session).
- [x] Backend: `POST /api/billing/webhook/stripe` (signature verify, idempotent).
- [x] Backend: CSRF exemption for webhook path only.
- [x] Backend: `GET /api/billing/history`; `plans.checkout_enabled` by config.
- [x] Frontend: billing page calls checkout + redirects (plus history/notice).
- [x] Docs: expand `docs/PAYMENTS.md` with the full Stripe procedure.
- [!] Needs credentials to smoke test: `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`.

### Phase 5 — Verification
- [x] `ruff check app` — all checks passed.
- [x] `pytest -q` — 95 passed, 2 warnings (~10 min).
- [x] `alembic upgrade head` — applied in Docker (`0012_user_token_version ->
      0013_accounts_payments`).
- [x] `npm run lint` — passes.
- [x] `npx tsc --noEmit` — passes.
- [x] `npm run build` — passes (48 routes).
- [x] Frontend production image (`frontend/Dockerfile` multi-stage) serving
      `next start`.
- [x] HTTP smoke: `/`, `/login`, `/register`, `/forgot-password`, `/privacy`,
      `/terms`, `/refund-policy`, `/contact`, `/how-it-works`,
      `/api/public/stats`, `/api/public/featured` all return 200.
- [x] Backend syntax parse (`ast.parse` over 95 files) — no syntax errors in
      changed files.
- [!] Manual smoke notes — needs Stripe/Google credentials.

---

## Session log

### 2026-11-08
- Read the platform (README, master prompt, docs, backend routers/models,
  frontend pages/api client) and confirmed the current state.
- Wrote `plan_fornt.md` and this worklog.
- No application code changed yet in this entry.

### 2026-11-08 (implementation session)
- Backend: public stats/featured router; auth forgot/reset/Google endpoints;
  generic `AuthToken` + `google_sub` + `Payment` models and migration 0013;
  SMTP/console email service; billing router rewritten for Stripe Checkout +
  signed webhook + history; CSRF exemption for `/api/billing/webhook/`; env
  example updated.
- Frontend: `serverApi`, `PublicHeader`, `PublicFooter`, full landing rewrite
  with `lp-*` CSS; legal pages `/privacy`, `/terms`, `/refund-policy`,
  `/contact`; `/forgot-password` and `/reset-password`; login show/hide +
  forgot link; register confirm/strength/consent; `GoogleButton`; billing
  checkout + history UI.
- Verification: `npm run lint` and `npm run build` pass. Backend checks still
  need Docker.

### 2026-11-08 (verification + docs session)
- Finished landing `lp-*` CSS (including an override of the global `footer`
  element rule for `.lp-footer`), legal/public pages, auth recovery pages,
  login/register UX, `GoogleButton`, and billing checkout/history UI.
- Expanded `docs/PAYMENTS.md` with the full Stripe test/live procedure,
  endpoint reference, security model, troubleshooting, and alternatives.
- Added `BACKEND_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to
  `frontend/.env.example`.
- Fixed lint rule `react-hooks/set-state-in-effect` by deriving URL state with
  `useSearchParams` behind `<Suspense>` in `/billing` and `/reset-password`.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass.
  Docker daemon is not running, so backend `ruff`/`pytest`/migration remain
  pending.

### 2026-11-09 (Docker runtime + performance)
- Docker Desktop now running. Applied migration `0013_accounts_payments` in
  Docker and confirmed the backend `/health` endpoint.
- Diagnosed the "frontend not working" report: it was Next.js dev-mode compile
  time on the Windows bind mount (first `/` compile 2.5–3.3 min; later ~7–20 s),
  not a crash. HTML was valid and all routes returned 200.
- Removed `uvicorn --reload` from the Docker backend command; the watchfiles
  polling loop was keeping CPU near 100%. Idle CPU is now <1% and the
  watchfiles `Input/output error` crash is gone.
- Moved the frontend from `next dev` to a multi-stage production image
  (`frontend/Dockerfile`) served by `next start`; removed the slow Windows bind
  mounts. `docker compose up -d --build frontend` produces 48 routes.
- Added in-process 120 s caching to `/api/public/stats` and
  `/api/public/featured`, and ISR (`revalidate = 60`) on the landing page.
- Measured after warm-up: `/` 0.9 s, `/login` 1.7 s, `/privacy` 0.5 s, proxied
  `/api/public/stats` 0.24 s, `/api/public/featured` returns 3 live items.
- Verified live landing data (`9,338` scholarships, `844` universities,
  `33` countries) is present in the server-rendered HTML.
- Backend checks in Docker: `ruff check app` passed; `pytest -q` 95 passed
  (2 deprecation warnings) in ~10 minutes.
- Saved the Google OAuth / SMTP / Stripe credential setup guide in
  `docs/SETUP_GOOGLE_EMAIL_STRIPE.md`.
- Footer: removed the **Staff** column (admin + consultant login links) from
  `PublicFooter`; the column grid is now 3 wide. Rebuilt the production image
  and verified `/`, `/how-it-works`, `/privacy`, `/login` no longer contain
  `/admin/login` or `/consultant/login`.
- Remaining: Stripe/Google credential smoke tests.

---

## Decisions made during implementation
(Add short lines here when deviating from `plan_fornt.md`.)

- Used one generic `AuthToken` table (purpose + token hash) instead of a
  separate `PasswordResetToken` model; it also covers email verification later.
- Stripe is called via raw REST (`httpx`) with manual HMAC verification instead
  of adding the `stripe` SDK; Google is verified via `tokeninfo` instead of
  `google-auth`. Keeps backend dependencies unchanged.
- No fabricated testimonials or social proof; landing uses live counters,
  verifiable design commitments, and a transparent disclaimer.
- `support@scholario.ai` is a placeholder in footer/legal pages — confirm the
  real support address before production.
- Frontend runs as a production image in Docker (`next start`). Code changes
  require `docker compose up -d --build frontend`; dev mode is unusable on this
  Windows bind mount because each route takes minutes to compile.
- Backend runs without `--reload`. After Python changes, run
  `docker compose restart backend` (the restart re-runs migrations/seeding).
- `/api/public/stats` and `/api/public/featured` are cached in-process for
  120 s, and the landing page uses ISR (`revalidate = 60`). Marketing counters
  can be up to two minutes stale, which is acceptable.

---

## Known limitations / follow-ups
- Real email delivery requires SMTP env; default is a console stub.
- Stripe and Google cannot be fully smoke-tested without live/test credentials.
- Real student testimonials are intentionally not fabricated; add only when real
  and consented.
- Migration `0013_accounts_payments` is applied in the Docker SQLite database;
  re-run `docker compose run --rm backend python -m alembic upgrade head` for
  other environments.
- Backend `ruff`/`pytest` pass in Docker (95 tests, ~10 min).
- The frontend production image must be rebuilt after source changes and after
  setting `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (it is baked at build time).
- Legal pages are accurate first drafts but need a real legal review, and the
  support email must be confirmed before launch.
- Email-verification enforcement is deferred behind `REQUIRE_EMAIL_VERIFICATION`.
