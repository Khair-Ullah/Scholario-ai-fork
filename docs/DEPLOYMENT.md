# Deployment

## Local

Copy the backend and frontend environment examples, then run `docker compose up --build`. The API is on port 8000 and Next.js on port 3000.

The backend container applies `alembic upgrade head` and `seed_templates` before Uvicorn starts, so a fresh clone only needs the CSV import and the first admin:

```sh
make seed                                                   # imports backend/data/*.csv (idempotent)
make seed-admin EMAIL=admin@example.com PASSWORD=your-password
```

Storage layout inside the container: `/data` is bind-mounted from the repository `backend/data/` directory so CSV files are visible to import scripts, and the named volume `scholario-db` is mounted at `/data/db` so the SQLite file stays on the Docker filesystem rather than a Windows bind mount. `DATABASE_URL` therefore defaults to `sqlite:////data/db/scholario.db`.

`make logs`, `make ps`, `make down`, and `make test` wrap the other routine commands. The build sets `PIP_DEFAULT_TIMEOUT=300` and `PIP_RETRIES=10` and keeps pip's cache layer, so slow or flaky networks do not fail `pip install`.

For manual development without Docker, install `backend/requirements.txt`, run `alembic upgrade head`, start Uvicorn, install frontend npm dependencies, and run `npm run dev`.

## Production outline

Use PostgreSQL with a private `DATABASE_URL`, separate frontend/backend services, HTTPS, an explicit CORS allowlist, secure cookie settings, and a secret manager. Run Alembic migrations before starting application instances. Create the first admin with the dedicated script, import and verify the CSV, configure backups and restore drills, rotate secrets, and monitor health/logs. Never deploy local demo credentials or commit `.env` files.

Detailed VPS and managed-host procedures, environment-variable inventory, Nginx/TLS, backups, and release checks will be completed before the deployment milestone.