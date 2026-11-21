# Production Readiness Checklist

**Status:** Target decided: Vercel frontend + Railway API/Postgres. External
service and operational sign-offs are still pending.
**Last updated:** 2026-11-20
**Owner:** TBD

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the concrete platform setup and
[`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md) for the current item-by-item
status.

**Quick actionable version:** [`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md)

This document is the pre-production checklist for Scholario. Do not deploy to
production until every P0 item is closed and the acceptance criteria at the end
of this file are met. No deployment can guarantee zero errors, but these
controls remove the most common causes of post-deployment incidents.

## Current verified state (local)

- PostgreSQL 16 is running with the migrated data:
  - `scholarships`: 9,338
  - `university_country`: 844
  - `templates`: 8
- Backend and frontend health checks return HTTP 200.
- `ruff check app scripts alembic` passes.
- Fast migration-relevant tests pass: 32 unit/import tests plus 2 critical API
  tests.
- The full test suite was not run to completion on the current machine because
  bcrypt costs about 4.4 seconds per hash here. This is a hardware/CPU
  limitation, not a test failure. See "Configurable password hashing" below.
- Local Docker Desktop issues (low `C:` space, containerd snapshot metadata
  errors, and the Electron UI `ChunkLoadError`) are development-environment
  issues. They must not be carried into production; production should run on
  Linux with a dedicated data disk.

## Recommended deployment target

Preferred for the hackathon and the first production release:

- Linux VPS with Docker Compose, or a PaaS such as Render/Fly/Railway.
- Managed PostgreSQL (Neon, Supabase, or RDS) with automated backups.
- Caddy or Nginx in front of the app for HTTPS, compression, request limits,
  and security headers.
- Upstash Redis (or equivalent) for shared rate limiting and background jobs.
- Sentry (or equivalent) for backend and frontend error tracking.
- Frontend served from the same origin behind the reverse proxy, or from Vercel
  with an explicit CORS allowlist.

Avoid Docker Desktop, the `C:` drive, and the current local vhdx layout for
production. Do not expose PostgreSQL or the backend directly to the internet.

## P0 — must fix before deploying

### Network and container isolation

- [ ] Remove the public PostgreSQL port mapping (`5432:5432`) from
      `docker-compose.yml`.
- [ ] Remove the public backend port mapping (`8000:8000`) when the frontend
      proxies `/api` internally. If a public API is required, expose it only
      through the reverse proxy with HTTPS and rate limiting.
- [ ] Remove the `./backend:/app` bind mount from production. Run the immutable
      image. Mount only data or backup files that are intentionally needed.
- [ ] Put the database, backend, and frontend on a private container network.
      Only the reverse proxy should publish ports 80 and 443.

### Secrets and configuration

- [ ] Remove the default database password fallback
      (`change_this_strong_password`). Require `DB_PASSWORD` or an explicit
      `DATABASE_URL`.
- [ ] Load production secrets from the platform secret manager, not from a
      committed file. Keep `.env` and `backend/.env` out of images and Git.
- [ ] Validate required settings at startup and fail fast: `SECRET_KEY`
      (32+ random characters), `DATABASE_URL`, `FRONTEND_ORIGINS`, and any
      enabled provider credentials.
- [ ] Set `APP_ENV=production`.
- [ ] Set `FRONTEND_ORIGINS` to the real frontend domain; do not leave
      `http://localhost:3000` in production.
- [ ] Configure cookies with `Secure`, `HttpOnly`, and an appropriate
      `SameSite` value. Keep HSTS enabled in production.
- [ ] Keep the CSRF protection enabled for all unsafe methods except verified
      payment webhooks.

### Database and migrations

- [ ] Run migrations as a separate release job, not from the backend start
      command. Use a `migrate` service or platform release command that runs
      `alembic upgrade head` and the idempotent template seed.
- [ ] Make the backend depend on the migration job completing successfully.
      This avoids races when more than one backend replica starts.
- [ ] Back up the database before every migration.
- [ ] Add a guard to `scripts/migrate_sqlite_to_postgres.py`: the script
      currently runs `TRUNCATE ... CASCADE`. Require an explicit
      `CONFIRM_TRUNCATE=yes` flag and add a `--dry-run` mode.
- [ ] In production without the development bind mount, pass
      `SOURCE_DATABASE_URL` explicitly when running the one-time SQLite copy.
- [ ] Confirm the migration from a fresh empty database, and also from the
      previous Alembic revision.
- [ ] Configure automated backups, offsite retention, and a tested restore
      procedure. For managed PostgreSQL, enable point-in-time recovery where
      available.

### Runtime hardening

- [ ] Add `restart: unless-stopped` to every long-running service.
- [ ] Add `init: true` and a graceful shutdown window to the backend
      (Uvicorn graceful timeout plus `stop_grace_period`).
- [ ] Run the backend and frontend containers as non-root users.
- [ ] Add CPU and memory limits appropriate for the host.
- [ ] Add Docker log rotation, for example `max-size: 10m` and `max-file: 3`.
- [ ] Add a frontend health check; it currently has none.
- [ ] Pin base images and runtime dependencies for reproducible builds.
- [ ] Add a readiness endpoint that checks the database with `SELECT 1`.
      Keep `/health` as the lightweight liveness endpoint.

## P1 — strongly recommended before launch

### Rate limiting and abuse protection

- [ ] The current limiter in `backend/app/core/ratelimit.py` uses in-memory
      storage. Move it to Redis (`storage_uri=redis://...`) so limits work
      across workers and replicas.
- [ ] Keep stricter limits on login, registration, password reset, AI calls,
      and admin endpoints.
- [ ] Keep account lockout and admin MFA enforcement enabled.

### CI/CD and testing

- [ ] Add CI that runs `ruff`, the backend test suite, frontend lint and build,
      Docker builds, and dependency audits.
- [ ] Add a PostgreSQL service to CI and run integration tests against it.
      SQLite tests do not catch JSON, sequence, constraint, or concurrency
      differences.
- [ ] Add a migration smoke test that starts from an empty database and from
      the previous revision.
- [ ] Add Dependabot or equivalent dependency updates.
- [ ] Block deployment when lint, tests, or builds fail.

### Configurable password hashing

- [ ] Make the bcrypt cost configurable, for example
      `PASSWORD_HASH_ROUNDS=12` in production and `4` in tests. This keeps
      production security intact while making the test suite usable on slow
      development machines.
- [ ] Consider Argon2id if the deployment platform supports it, after measuring
      login latency.

### External services

- [ ] SMS/email and AI calls must have timeouts and bounded retries.
- [ ] Move slow email and AI work to a background queue or worker with retries
      and idempotency keys. A provider failure must not fail registration or
      another core request.
- [ ] Keep the AI mock fallback and per-user quotas/cost limits.
- [ ] Verify Stripe webhook signatures and make webhook handling idempotent.
- [ ] Log provider failures with enough context to debug, but never log secrets
      or full personal data.

### Observability

- [ ] Send backend and frontend errors to Sentry or an equivalent service.
- [ ] Emit structured logs with request IDs and latency.
- [ ] Add uptime checks for the frontend, API, and readiness endpoint.
- [ ] Monitor database connections, query latency, 5xx rate, AI failure rate,
      queue depth, CPU, memory, and disk space.
- [ ] Add alerts for disk usage, failed backups, and elevated error rates.

### Frontend production build

- [ ] Use Next.js standalone output to reduce the runtime image and dependency
      surface.
- [ ] Run the frontend container as a non-root user.
- [ ] Add CSP and security headers at the reverse proxy or Next.js config.
- [ ] Keep `NEXT_PUBLIC_API_URL` empty when using the same-origin `/api` proxy.
- [ ] Confirm that the API rewrite points to the internal backend URL in the
      deployed environment.

## P2 — after the first stable release

- [ ] Tune the SQLAlchemy pool (`pool_size`, `max_overflow`, `pool_recycle`,
      `pool_timeout`) and set a statement timeout.
- [ ] Add indexes based on real slow-query logs; consider `pg_trgm` for search.
- [ ] Add scheduled verification of scholarship deadlines and application
      links, with "last verified" and stale-data labels.
- [ ] If file uploads are added or already exist, store them in object storage
      with size/type limits, signed URLs, and malware scanning.
- [ ] Add load tests for catalog search, matching, and AI endpoints.
- [ ] Document and test a rollback procedure.
- [ ] Define data retention and account-deletion behavior.

## Repo-specific notes

- `docker-compose.yml` is development-oriented: it bind-mounts backend code,
  publishes database and backend ports, uses a default database password,
  runs migrations on every start, and has no restart policy, log rotation, or
  resource limits.
- `backend/.dockerignore` and `frontend/.dockerignore` already exclude `.env`
  files and the SQLite database. Keep this behavior.
- `frontend/next.config.mjs` rewrites `/api` to `BACKEND_URL`. The same-origin
  proxy avoids most CORS and cookie problems.
- `Makefile` now defaults `migrate-data` to `sqlite:////app/scholario.db`.
  In production without the bind mount, pass `SOURCE_DATABASE_URL` pointing to
  a mounted backup file.
- `backend/app/core/ratelimit.py` uses in-memory storage.
- `backend/app/db/session.py` uses SQLAlchemy defaults plus `pool_pre_ping`.
- `backend/scripts/migrate_sqlite_to_postgres.py` truncates target tables.
- `backend/Dockerfile` and `frontend/Dockerfile` currently run as root and are
  not production-hardened.
- `docs/DEPLOYMENT.md` contains the current deployment outline and local
  migration steps.

## Proposed implementation order

1. Create `docker-compose.prod.yml` with private networking, a migration job,
   restart policies, log rotation, resource limits, non-root users, and a
   reverse proxy.
2. Add startup configuration validation and a database readiness endpoint.
3. Add CI with a PostgreSQL integration job.
4. Add optional Redis-backed rate limiting.
5. Add the backup script, restore documentation, and migration guard.
6. Harden the frontend image with standalone output and a non-root user.

## Open decisions

- Deployment target: VPS + Compose + Caddy, or Render/Fly/Railway + managed
  PostgreSQL.
- Managed PostgreSQL provider and backup retention.
- Production domain and TLS ownership.
- Email provider and sending limits.
- AI budget, quotas, and provider keys.
- Whether admin MFA is mandatory from day one.
- Scholarship data refresh cadence and source ownership.
- RPO/RTO targets for the database.

## Acceptance criteria

- [ ] `docker compose -f docker-compose.prod.yml config` is valid.
- [ ] A fresh database passes migrations, template seed, and smoke tests.
- [ ] No secrets are present in images, Git history, or logs.
- [ ] A backup has been restored successfully in a test environment.
- [ ] Liveness and readiness checks are green behind the reverse proxy.
- [ ] CI is green and deployment is blocked on failures.
- [ ] Rate limiting works across multiple workers.
- [ ] Rollback and incident-response steps are documented.
- [ ] The team has explicitly approved the production target and launch date.
