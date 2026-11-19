# Deployment

## Local

Copy the backend and frontend environment examples, then run `docker compose up --build`. The API is on port 8000 and Next.js on port 3000.

If you already run the frontend on the host with `npm run dev` (port 3000), start only the backend container with `make up-backend` (`docker compose up -d backend`). Publishing the frontend container would otherwise fail with `bind: Only one usage of each socket address` / `(HTTP code 500) server error - ports are not available`. Keep using the host dev server at <http://localhost:3000>, which reaches the containerised API at <http://localhost:8000>.

The backend container applies `alembic upgrade head` and `seed_templates` before Uvicorn starts, so a fresh clone only needs the CSV import and the first admin:

```sh
make seed                                                   # imports backend/data/*.csv (idempotent)
make seed-admin EMAIL=admin@example.com PASSWORD=your-password
```

Storage layout inside the container: `/data` is bind-mounted from the repository `backend/data/` directory so CSV files are visible to import scripts. PostgreSQL data lives in the named volume `pgdata`. The `db` service uses `postgres:16-alpine` and `DATABASE_URL` defaults to `postgresql+psycopg://scholario:<DB_PASSWORD>@db:5432/scholario`. Set `DB_PASSWORD` (and, if needed, `DATABASE_URL`) in a root `.env` file or the shell before starting Compose.

### Migrating existing SQLite data

The old SQLite database lived in the `scholario-db` volume at `/data/db/scholario.db`. Before removing that volume, back it up to the bind mount and copy it into PostgreSQL once:

```sh
docker compose exec backend cp /data/db/scholario.db /data/scholario_backup.db
docker compose down
docker compose up -d --build
make migrate-data SOURCE_DATABASE_URL=sqlite:////data/scholario_backup.db
```

`make migrate-data` runs `scripts/migrate_sqlite_to_postgres`, which reads `/app/scholario.db` by default (override with `SOURCE_DATABASE_URL`; the backup flow above uses `/data/scholario_backup.db`), truncates the PostgreSQL tables, copies every row, and resets the id sequences. Verify with `docker compose exec db psql -U scholario -d scholario -c "\dt"`. Keep the backup until the PostgreSQL data has been checked.

`make logs`, `make ps`, `make down`, and `make test` wrap the other routine commands. The build sets `PIP_DEFAULT_TIMEOUT=300` and `PIP_RETRIES=10` and keeps pip's cache layer, so slow or flaky networks do not fail `pip install`.

For manual development without Docker, install `backend/requirements.txt`, run `alembic upgrade head`, start Uvicorn, install frontend npm dependencies, and run `npm run dev`.

`make test-frontend` uses `docker compose run --rm --no-deps` rather than `exec`, so frontend lint and build run in a throwaway container even while a host dev server occupies port 3000.

## Production outline

See [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) for the full pre-production checklist, repo-specific risks, and open deployment decisions. For the short P0 checklist, use [`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md).

Use PostgreSQL with a private `DATABASE_URL`, separate frontend/backend services, HTTPS, an explicit CORS allowlist, secure cookie settings, and a secret manager. Run Alembic migrations before starting application instances. Create the first admin with the dedicated script, import and verify the CSV, configure backups and restore drills, rotate secrets, and monitor health/logs. Never deploy local demo credentials or commit `.env` files.

Detailed VPS and managed-host procedures, environment-variable inventory, Nginx/TLS, backups, and release checks will be completed before the deployment milestone.