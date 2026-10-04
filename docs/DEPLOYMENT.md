# Deployment

## Local

Copy the backend and frontend environment examples, then run `docker compose up --build`. The API is on port 8000 and Next.js on port 3000. For manual development, install `backend/requirements.txt`, run Uvicorn, install frontend npm dependencies, and run `npm run dev`.

## Production outline

Use PostgreSQL with a private `DATABASE_URL`, separate frontend/backend services, HTTPS, an explicit CORS allowlist, secure cookie settings, and a secret manager. Run Alembic migrations before starting application instances. Create the first admin with the dedicated script, import and verify the CSV, configure backups and restore drills, rotate secrets, and monitor health/logs. Never deploy local demo credentials or commit `.env` files.

Detailed VPS and managed-host procedures, environment-variable inventory, Nginx/TLS, backups, and release checks will be completed before the deployment milestone.