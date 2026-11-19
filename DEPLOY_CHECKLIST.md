# Scholario — Pre-Deploy Checklist

**Last updated:** 2026-11-17

**Status:** NOT READY for public production.

This file is the short, actionable list of what must be finished before a real
deployment. The full background is in
[`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md). The current
[`docker-compose.yml`](docker-compose.yml) is for local development only — do not
expose it to the internet.

---

## Rule

Do not launch until every **P0** item and every **Launch gate** item below is
checked. If an item cannot be completed, record the risk and get explicit team
approval before launch.

---

## Current dev-only risks

| Risk | Where |
| --- | --- |
| Default database password fallback | `docker-compose.yml:6` |
| PostgreSQL published publicly on `5432` | `docker-compose.yml:10` |
| Backend published publicly on `8000` | `docker-compose.yml:28` |
| Backend source bind-mounted into container | `docker-compose.yml:31` |
| Migrations run on every backend start | `docker-compose.yml:21` |
| CORS origin hard-coded to localhost | `docker-compose.yml:26` |
| Containers run as root | `backend/Dockerfile`, `frontend/Dockerfile` |
| Rate limiting is in-memory only | `backend/app/core/ratelimit.py:13` |
| Only a lightweight `/health`, no DB readiness endpoint | `backend/app/main.py:102` |
| No restart policy, log rotation, resource limits, or frontend healthcheck | `docker-compose.yml` |

---

## P0 — Required before public deployment

### 1. Production Compose and network isolation

- [ ] Create `docker-compose.prod.yml`.
- [ ] Use a private container network for database, backend, and frontend.
- [ ] Publish only the reverse proxy on ports `80` and `443`.
- [ ] Do **not** publish PostgreSQL (`5432`) or backend (`8000`).
- [ ] Remove backend source bind mounts; run immutable images.
- [ ] Remove the default database password; require `DB_PASSWORD` or an
      explicit `DATABASE_URL`.
- [ ] Keep the frontend same-origin `/api` proxy, or set an explicit production
      CORS allowlist.
- [ ] Add Caddy/Nginx with HTTPS, compression, request limits, and security
      headers.
- [ ] Verify:

  ```sh
  docker compose -f docker-compose.prod.yml config
  ```

  Only `80`/`443` may be publicly exposed.

### 2. Secrets and configuration

- [ ] Set `APP_ENV=production`.
- [ ] Load secrets from the platform secret manager, not a committed file.
- [ ] Require `SECRET_KEY` with at least 32 random characters.
- [ ] Set the real `DATABASE_URL`.
- [ ] Set `FRONTEND_ORIGINS` and `FRONTEND_BASE_URL` to the real domain.
- [ ] Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `GOOGLE_CLIENT_ID`, SMTP variables, and the AI provider key if enabled.
- [ ] Add startup validation that fails fast when required settings are missing.
- [ ] Confirm no `.env` file or secret is present in images, Git history, or
      logs.
- [ ] Confirm production cookies are `Secure`, `HttpOnly`, and use an
      appropriate `SameSite` value.
- [ ] Keep CSRF protection enabled for all unsafe methods except the verified
      payment webhook.

### 3. Database, migrations, and backups

- [ ] Run `alembic upgrade head` as a separate release job, not from the backend
      start command.
- [ ] Make backend startup depend on the migration job completing successfully.
- [ ] Test migrations from a fresh empty database.
- [ ] Test migration from the previous Alembic revision.
- [ ] Back up the database before every migration.
- [ ] Configure automated backups, offsite retention, and point-in-time
      recovery if the provider supports it.
- [ ] Perform and document a successful restore drill.
- [ ] If `scripts/migrate_sqlite_to_postgres.py` is used, add
      `CONFIRM_TRUNCATE=yes` and a `--dry-run` guard.
- [ ] Verify the seeded catalogue after deploy: 9,338 scholarships, 844
      universities, 33 countries, 8 templates.

### 4. Runtime hardening

- [ ] Run backend and frontend containers as non-root users.
- [ ] Add `restart: unless-stopped` to long-running services.
- [ ] Add `init: true` and a graceful shutdown window for the backend.
- [ ] Add CPU and memory limits.
- [ ] Add Docker log rotation (`max-size: 10m`, `max-file: 3`).
- [ ] Add a frontend healthcheck.
- [ ] Keep `/health` as liveness and add `/ready` that runs a database check
      (`SELECT 1`).
- [ ] Pin base images and runtime dependencies for reproducible builds.
- [ ] Remove migrations and template seeding from the backend start command.

### 5. Rate limiting and abuse protection

- [ ] Move `slowapi` storage to Redis so limits work across workers and
      replicas.
- [ ] Keep stricter limits on login, registration, password reset, AI, and
      admin endpoints.
- [ ] Keep failed-login lockout enabled.
- [ ] Enforce staff 2FA, at least for super admins.

### 6. Observability

- [ ] Send backend and frontend errors to Sentry or equivalent.
- [ ] Emit structured logs with request IDs and latency.
- [ ] Add uptime checks for the frontend, API, and readiness endpoint.
- [ ] Monitor 5xx rate, database connections, query latency, AI failure rate,
      CPU, memory, and disk.
- [ ] Alert on failed backups, high disk usage, and elevated error rates.
- [ ] Define log retention and access.

### 7. External service smoke tests

- [ ] Stripe test-mode checkout completes and redirects back correctly.
- [ ] Stripe webhook signature verifies and upgrades the user exactly once.
- [ ] Google sign-in works with the production client ID and allowed origins.
- [ ] Password-reset email and contact-form email arrive through real SMTP.
- [ ] AI provider works, has timeouts and bounded retries, and falls back
      safely when unavailable.
- [ ] Provider failures never log secrets or full personal data.

### 8. CI/CD and release gate

- [ ] Run backend tests against PostgreSQL in CI, not only SQLite.
- [ ] Add a migration smoke test for a fresh database and the previous revision.
- [ ] Build both Docker images in CI.
- [ ] Run frontend lint, typecheck, and production build in CI.
- [ ] Add a Playwright smoke flow for register → login → onboarding → match →
      save → apply.
- [ ] Add a Lighthouse/accessibility baseline check.
- [ ] Run dependency audits.
- [ ] Block deployment when any check fails.
- [ ] Document and test the rollback procedure.

### 9. Launch operations

- [ ] Point the real domain and DNS at the reverse proxy.
- [ ] Confirm TLS certificate issuance and renewal.
- [ ] Replace `support@scholario.ai` with the real support address.
- [ ] Get legal review for privacy, terms, and refund pages.
- [ ] Define data retention, account deletion, and backup RPO/RTO.
- [ ] Create production super-admin accounts with strong passwords and MFA.
- [ ] Remove or rotate test/preview accounts and local demo credentials.
- [ ] Record the on-call owner and incident-response steps.
- [ ] Get explicit team approval for the launch date and deployment target.

---

## Already in place — do not redo

- CSRF double-submit protection.
- Secure cookie settings when `APP_ENV=production`.
- Password hashing, refresh-token rotation, logout denylist.
- Login lockout, suspicious-activity warnings, optional staff TOTP.
- Security headers (HSTS in production, `nosniff`, frame denial, referrer and
  permissions policies).
- Multi-stage frontend production image.
- Existing CI workflow for Ruff, pytest coverage, frontend lint, and build.
- Alembic migrations through `0013_accounts_payments`.
- Public pages, student workspace, admin panel, consultant workspace, billing,
  Google sign-in, password reset, and legal-page drafts.
- Recorded verification: 95 backend tests pass; Ruff, ESLint, TypeScript, and
  frontend build pass.

---

## Recommended implementation order

1. Create `docker-compose.prod.yml` with private networking, a migration job,
   restart policies, log rotation, resource limits, non-root users, and a
   reverse proxy.
2. Add startup configuration validation and a database readiness endpoint.
3. Add CI with a PostgreSQL integration job and migration smoke test.
4. Add optional Redis-backed rate limiting.
5. Add backup/restore scripts and the SQLite migration guard.
6. Harden the frontend image with standalone output and a non-root user.
7. Run Stripe, Google, SMTP, and AI smoke tests.
8. Finish legal/support/domain/on-call sign-off.

---

## Definition of done

- [ ] `docker compose -f docker-compose.prod.yml config` is valid.
- [ ] A fresh database passes migrations, template seed, and smoke tests.
- [ ] No secrets exist in images, Git history, or logs.
- [ ] A database backup has been restored successfully in a test environment.
- [ ] Liveness and readiness checks are green behind HTTPS.
- [ ] CI is green and deployment is blocked on failures.
- [ ] Rate limiting works across multiple workers.
- [ ] Stripe, Google, SMTP, and AI smoke tests pass.
- [ ] Rollback and incident-response steps are documented.
- [ ] Legal, support, domain, and on-call ownership are approved.
- [ ] The team has explicitly approved the production target and launch date.
