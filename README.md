# Scholario

> [!CAUTION]
> **NOTICE:** The system is in the building stage, so issues may occur. Please use the demo account below to review the project only.
> **Demo Account:** student@scholario.com / demo-password-123 -> /login
> **Live Link:** (https://scholario-ai.vercel.app/)

Scholario is a scholarship discovery and application workspace for students, with a focus on opportunities relevant to students from Pakistan. This repository is being rebuilt as a FastAPI + Next.js application following [SCHOLARIO_MASTER_PROMPT.md](SCHOLARIO_MASTER_PROMPT.md). Legacy prototype HTML files are preserved under `frontend/prototype/` as visual references; they are not the new application source.

## Features and status

The target product includes student onboarding, explainable scholarship matching, saved scholarships, application tracking, checklists, document templates, an offline AI advisor stub, and scholarship administration. The initial scaffold currently provides the runnable API health endpoint and frontend home screen. Scholarship matching and workflows are not yet implemented; see [docs/PROGRESS.md](docs/PROGRESS.md).

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL 16 via Docker Compose; `DATABASE_URL` selects the database |
| Tests | pytest, httpx; frontend build checks |
| Operations | Docker Compose, Alembic, GitHub Actions |

## Project structure

```text
backend/       FastAPI application, migrations, scripts, tests, and scholarship CSV data (backend/data/)
frontend/      Next.js App Router application (frontend/prototype/ holds legacy reference pages)
docs/          Product, architecture, API, and deployment documentation
```

## Quick start

Requirements: Docker with Compose v2. The backend image is Python 3.12 and requires Python 3.11+ if you run it outside Docker.

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up --build
```

Migrations and template seeding run automatically on backend start. Import the scholarship data once with `make seed`, then create the first admin with `make seed-admin EMAIL=admin@scholario.ai PASSWORD=your-password`. Add consultant accounts with `make seed-consultant EMAIL=partner@example.com PASSWORD=your-password NAME="Partner Name"`.

Open the frontend at <http://localhost:3000> and API docs at <http://localhost:8000/docs>. Health check: <http://localhost:8000/health>.

For manual development, run `cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && python -m alembic upgrade head && python -m uvicorn app.main:app --reload` and, in another terminal, `cd frontend && npm ci && npm run dev`.

If you run the frontend on the host with `npm run dev`, start only the backend container with `make up-backend` (backend-only). Running `docker compose up` would also publish the frontend container on port 3000 and fail with `bind: Only one usage of each socket address` / `ports are not available`.

Common commands are wrapped by the `Makefile`: `make up`, `make up-backend`, `make logs`, `make ps`, `make down`, `make seed`, `make test`.

## Environment variables

Backend configuration is documented in [backend/.env.example](backend/.env.example); frontend configuration is in [frontend/.env.example](frontend/.env.example). Never commit `.env` or API keys.

## Matching

The planned matcher applies the target degree, IELTS tier cap, GPA tier cap, destination, and field rules from [docs/MATCHING_LOGIC.md](docs/MATCHING_LOGIC.md). It will not filter by origin country, funding preference, or optional preferences. It is not implemented in the initial scaffold.

## AI integration

AI will default to an offline mock provider. Provider methods and connection points are described in [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md). Add provider credentials only to the backend environment; never expose them to the browser.

## Payments

The billing module will use a provider interface and verified webhooks. See [docs/PAYMENTS.md](docs/PAYMENTS.md); payment processing is not enabled in the scaffold.

## Deployment and administration

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the planned deployment guide. The platform has three roles: `student`, `consultant`, and `super_admin`. Super admins sign in at `/admin` and manage the catalogue, consultants, users, templates, announcements, payments, settings, audit, and warnings. Consultants sign in at `/consultant` and manage only the scholarships they own, view the students who engage with them, and acknowledge platform warnings. Consultant accounts are created by a super admin (panel or `make seed-consultant EMAIL=… PASSWORD=… NAME="…"`); staff logins support TOTP two-factor authentication.

## Testing and API

Run `make test` for backend Ruff/pytest coverage (80% minimum) and frontend ESLint/production build. API endpoint documentation is generated at `/docs` and summarized in [docs/API.md](docs/API.md).

## Contributing and license

Keep changes aligned with the master build prompt and record implementation decisions in [docs/DECISIONS.md](docs/DECISIONS.md). No license has been selected yet.

## Progress

- [x] Steps 1–14 — Scaffold through core student workflows and partial admin tools (2026-10-03)
- [ ] Step 15 — Lighthouse/accessibility review and SEO metadata verification
- [ ] Step 16 — 80% service coverage, Playwright smoke flow, CI gates
- [ ] Step 17 — Final deployment, payment, AI, and SRS documentation review
- [x] Step 20 — Logout hardening: access-token denylist on logout and a global session-expiry redirect in the API client (2026-10-08)
- [x] Step 21 — Roles split (`student`/`consultant`/`super_admin`), scholarship ownership, `/consultant` workspace, TOTP 2FA with recovery codes, failed-login lockout, and suspicious-activity warnings (2026-10-10)

This is a substantial first implementation, not yet the complete acceptance-tested product. Remaining work is recorded in [docs/PROGRESS.md](docs/PROGRESS.md), including partial admin/billing features, an eight-template starter set, security follow-ups, and unavailable Docker Compose verification.

---

