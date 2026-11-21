# Deployment

## Selected target (2026-11-20)

| Layer | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | Root Directory: `frontend`; framework detected from `frontend/vercel.json`. |
| API | Railway | Service Root Directory: `backend`; builds `backend/Dockerfile.railway`. |
| Database | Railway Postgres | `postgresql://` URLs are normalized to `postgresql+psycopg://` in `app/core/config.py`. |
| Browser → API | Same-origin proxy | Vercel rewrites `/api/:path*` to `BACKEND_URL/api/:path*`, so auth cookies stay host-only. |

Real domain names and secrets are intentionally not committed. Replace `<...>` placeholders below.

## 1. Provision the backend

1. Create a Railway project and add a Postgres service.
2. Create a second service from this repo with **Root Directory = `backend`**.
3. Set the backend variables below in Railway (never in git).
4. Deploy. `backend/railway.toml` runs `alembic upgrade head` and `scripts.seed_templates` before the container starts, and uses `/ready` as the healthcheck.

> Railway config-as-code is deprecated and supported until 2026-12-01. The checked-in `railway.toml` is useful now; verify settings in the Railway dashboard before the final launch and move them there if needed.

### Required backend variables

| Variable | Example | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | Enables `Secure` cookies, HSTS, strict `/docs`, and production config validation. |
| `SECRET_KEY` | `<48+ random chars>` | Signs tokens; generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | from Postgres service | Railway provides `postgresql://...`; app auto-selects psycopg v3. |
| `FRONTEND_ORIGINS` | `https://scholario.ai` | CORS allowlist; comma-separated if using preview domains. |
| `FRONTEND_BASE_URL` | `https://scholario.ai` | Reset-password and checkout return URLs. |
| `PUBLIC_BASE_URL` | `https://scholario.ai` | Referral share links. |
| `TRUST_PROXY_HEADERS` | `true` | Needed behind Railway/Vercel proxies for per-client rate limiting. |

### Optional backend variables

| Variable | Example | Purpose |
| --- | --- | --- |
| `CONTACT_INBOX` | `support@scholario.ai` | Destination for `/api/public/contact`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | `<provider values>` | Enables real email; without these, email logging is dev-only. |
| `SMTP_FROM` / `SMTP_SSL` | `Scholario <no-reply@...>` / `true` | Sender and SSL mode. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | `<stripe keys>` | Enables checkout; webhook URL is `https://<domain>/api/billing/webhook/stripe`. |
| `GOOGLE_CLIENT_ID` | `<google oauth client>` | Backend Google token verification; frontend uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |
| `AI_PROVIDER` / `GEMINI_API_KEY` / `AI_MODEL` | `gemini` / `<key>` / `<model>` | AI chat; default is mock. |
| `AI_MODEL_FALLBACKS` / `AI_TIMEOUT_SECONDS` / `AI_THINKING_BUDGET` / `AI_FALLBACK_TO_MOCK` | see `backend/.env.example` | Provider tuning. |
| `SEVEN_PLUS_SEES_ALL` | `false` | Scholarship access rule. |
| `TOTP_ISSUER` | `Scholario` | MFA label. |

`backend/requirements.prod.txt` is pinned from the validated local image; the prod Dockerfile installs that file instead of the looser dev ranges.

## 2. First-run data

Migrations and template seeding run automatically. Import the scholarship dataset once after the first deploy (Railway one-off command in the backend service):

```sh
python -m scripts.import_csv --file data/fully_formated_scholarships.csv
```

Create the super admin once:

```sh
python -m scripts.create_admin --email <admin-email> --password '<strong-password>'
```

Do not commit copied CSVs with live user data. The files in `backend/data/` are product data only.

## 3. Deploy the frontend on Vercel

1. Import this repo with **Root Directory = `frontend`**; `frontend/vercel.json` sets `npm ci` and `npm run build`.
2. Set Vercel environment variables:
   - `BACKEND_URL=https://<railway-service-domain>` — required.
   - `NEXT_PUBLIC_API_URL=` — leave empty. The build fails deliberately if Vercel sees localhost or a public API URL here.
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google oauth client>` — optional.
3. Attach a custom domain so `FRONTEND_ORIGINS`, `FRONTEND_BASE_URL`, and `PUBLIC_BASE_URL` match the browser origin exactly.
4. Check Vercel **Deployment Protection** settings: keep it disabled for the public app, or allow the domains needed by webhooks/preview reviewers.

## 4. Verify

```sh
curl -fsS https://<domain>/api/health
curl -fsS https://<domain>/api/ready
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/auth/csrf
curl -fsS https://<railway-service-domain>/ready
```

`/api/health` and `/api/ready` are proxied aliases added for the Vercel rewrite;
the backend also keeps root `/health` and `/ready`, and Railway uses `/ready`
for its healthcheck.

Then in the browser: sign in → admin dashboard → check Notifications, Scholarships, Documents, and that a hard refresh does not log the user out.

## 5. Rollback

- Vercel: promote the previous successful deployment.
- Railway: redeploy the previous successful deployment; do not roll back `DATABASE_URL` unless a migration is known-compatible.

## Local development (unchanged)

```powershell
docker compose up -d --build
docker compose exec backend python -m alembic upgrade head
docker compose exec backend python -m scripts.seed_templates
npm --prefix frontend run dev
```

## 6. Step-by-step runbook (Vercel + Railway)

Yeh runbook un steps ka saved version hai jo chat me diye gaye. Secrets yahan
nahin, sirf platform dashboard me set karein.

### Step 0 - Code GitHub par daalein

Local changes ko push kiye baghair Vercel/Railway purana code deploy karenge.

```powershell
git status --short
git add <intended-files>
git commit -m "Prepare Vercel and Railway deployment"
git push origin faiz-updates
```

`git status` me pehle se kuch PDF deletions hain; unhe include karna ya restore
karna, ye launch owner decide kare.

### Step 1 - Railway project aur Postgres

1. Railway me **New Project → Deploy from GitHub repo**.
2. Repo `Scholario-ai/Scholario-ai`, branch `faiz-updates`.
3. **New → Database → Add PostgreSQL**.
4. Postgres service ke Variables se `DATABASE_URL` copy karein.

### Step 2 - Railway backend service

1. **New Service → GitHub Repo** → same repo/branch.
2. **Root Directory = `backend`**.
3. `backend/railway.toml` automatically use ho; agar na ho to Build settings me
   Dockerfile Path `Dockerfile.railway` set karein.
4. Variables:

```dotenv
APP_ENV=production
SECRET_KEY=<32-plus-random-characters>
DATABASE_URL=<railway-postgres-url>
FRONTEND_ORIGINS=https://<final-domain>
FRONTEND_BASE_URL=https://<final-domain>
PUBLIC_BASE_URL=https://<final-domain>
TRUST_PROXY_HEADERS=true
```

Optional: `SMTP_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`GOOGLE_CLIENT_ID`, `AI_PROVIDER`, `GEMINI_API_KEY`.

5. Deploy; logs me migrations, template seed, aur Uvicorn on `$PORT` verify karein.
6. Railway Config-as-Code 2026-12-01 ke baad deprecated hai, isliye dashboard me
   bhi settings verify karein.

### Step 3 - Ek dafa data aur admin

Railway backend shell me:

```sh
python -m scripts.import_csv --file data/fully_formated_scholarships.csv
python -m scripts.create_admin --email <admin-email> --password '<strong-password>'
```

Expected: 9,338 scholarships, 844 universities, 8 templates.

### Step 4 - Vercel frontend

1. Vercel me repo import karein; **Root Directory = `frontend`**.
2. `frontend/vercel.json` se `npm ci` aur `npm run build` chalte hain.
3. Environment Variables:

```dotenv
BACKEND_URL=https://<railway-service-domain>
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<optional>
```

`NEXT_PUBLIC_API_URL` empty hona chahiye; env change ke baad redeploy zaroori hai.

### Step 5 - Domain aur external callbacks

1. Vercel → Settings → Domains → custom domain + DNS.
2. Railway me `FRONTEND_ORIGINS`, `FRONTEND_BASE_URL`, `PUBLIC_BASE_URL` final
   HTTPS domain par update karke backend redeploy karein.
3. Stripe webhook: `https://<final-domain>/api/billing/webhook/stripe`.
4. Google OAuth authorized origin: `https://<final-domain>`.
5. Vercel Deployment Protection public app ke liye off ya appropriately allowed rakhein.

### Step 6 - Verification

```sh
curl -fsS https://<final-domain>/api/health
curl -fsS https://<final-domain>/api/ready
curl -fsS https://<railway-service-domain>/ready
curl -s -o /dev/null -w '%{http_code}\n' https://<final-domain>/api/auth/csrf
```

Browser: register/login, admin login, notifications, scholarships, document
export, aur hard refresh ke baad session.

### Troubleshooting

| Issue | Check |
| --- | --- |
| Vercel build fail | `BACKEND_URL` missing/localhost ya `NEXT_PUBLIC_API_URL` empty nahi |
| `/api/*` 404/502 | `BACKEND_URL` galat ya Railway service down |
| 429 | `TRUST_PROXY_HEADERS=true` missing |
| Scholarships empty | CSV import nahi chala |
| Admin login fail | `create_admin` nahi chala |
| Logout loop/cookie issue | HTTPS ya `FRONTEND_ORIGINS` mismatch |
