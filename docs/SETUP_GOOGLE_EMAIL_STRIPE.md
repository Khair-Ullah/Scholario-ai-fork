# Google, Email (SMTP), and Stripe Setup

> Saved notes for later. This file explains **what is already coded**, **what is
> still missing**, and the exact steps/commands to finish Google sign-in, password
> reset email, and Stripe payments.
>
> Do **not** commit `backend/.env`, root `.env`, or any real keys to git.

## Current status

| Feature | Code status | Credentials | Works now? |
|---|---|---|---|
| Google login/signup | Implemented | `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` missing | No — button hidden, API returns 503 |
| Password reset email | Implemented | SMTP not configured | No real email — link is printed in backend logs (console stub) |
| Stripe checkout | Implemented | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` empty | No — checkout returns 503, billing page shows payments disabled |

Code locations:

- Google API: `backend/app/routers/auth.py` (`POST /api/auth/google`, client ID check around line 331; student-only check around line 398).
- Google button: `frontend/src/components/GoogleButton.tsx` (`CLIENT_ID` around line 22).
- Reset link + email call: `backend/app/routers/auth.py` (`forgot-password` around line 256).
- SMTP sender: `backend/app/services/email.py`.
- Stripe: `backend/app/routers/billing.py` (plans around line 48, checkout around line 140, webhook around line 199).
- Docker env/build args: `docker-compose.yml` (backend `env_file`, frontend build arg `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).

---

## 1. Google login / signup

Google sign-in is **student-only**. The first Google login automatically creates
the account; there is no separate signup flow.

1. Open Google Cloud Console and create/select a project.
2. Configure **OAuth consent screen**:
   - User type: External (use Test users while developing).
   - Add your own Google account as a test user.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - your production domain, e.g. `https://scholario.ai`
   - Redirect URIs are not required for the Google Identity Services button.
4. Copy the Client ID (ends with `.apps.googleusercontent.com`).
5. Add it to `backend/.env`:

   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

6. Add the **same** Client ID to the project root `.env` (create it if missing):

   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

   This is required because Next.js bakes `NEXT_PUBLIC_*` values into the
   frontend bundle at build time. `frontend/.env.local` is **not** copied into
   the Docker image (it is excluded by `.dockerignore`).

7. Apply the changes:

   ```powershell
   docker compose up -d --build frontend
   docker compose up -d --force-recreate backend
   ```

8. Open `http://localhost:3000/login` or `/register`. The Google button should
   appear. If it does not, the `NEXT_PUBLIC_GOOGLE_CLIENT_ID` build arg was not
   present during the frontend rebuild.

Expected failures if misconfigured:

- Button missing → `NEXT_PUBLIC_GOOGLE_CLIENT_ID` not baked into the build.
- `503 GOOGLE_AUTH_DISABLED` → `GOOGLE_CLIENT_ID` missing in `backend/.env`.
- `401 GOOGLE_INVALID` → Client ID mismatch or token audience is wrong.
- `403 AUTH_FORBIDDEN` → the email belongs to a staff/admin/consultant account;
  those roles must use their dedicated portal.

---

## 2. Password reset email (SMTP)

Right now SMTP is not configured, so `backend/app/services/email.py` uses a
**console stub**: the reset email body (including the link) is printed to the
backend logs.

Quick test without SMTP:

1. Call `POST /api/auth/forgot-password` with an existing account email.
2. Read the link from the backend logs:

   ```powershell
   docker compose logs --tail=100 backend
   ```

   Look for `[email stub]` and `/reset-password?token=...`.

### Configure a real sender

Add these to `backend/.env`:

```env
FRONTEND_BASE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-16-char-google-app-password
SMTP_FROM="Scholario <your@gmail.com>"
SMTP_SSL=false
```

Notes:

- `FRONTEND_BASE_URL` is used to build the reset link. Set it to the real site
  URL in production.
- `SMTP_FROM` must be a sender address/domain you are allowed to send from.
  The current default `no-reply@scholario.ai` is a placeholder.
- For Gmail: enable 2-Step Verification, then create an **App Password**.
  Normal Gmail passwords will not work.
- Gmail has sending limits; for production prefer a transactional provider.

Provider examples (all use the same `email.py`):

- **Resend SMTP**: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`,
  `SMTP_USER=resend`, `SMTP_PASSWORD=<Resend API key>`,
  `SMTP_FROM="Scholario <no-reply@your-verified-domain>"`.
- **Brevo**: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`,
  `SMTP_USER=<Brevo login>`, `SMTP_PASSWORD=<Brevo SMTP key>`.
- **SendGrid**: `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`,
  `SMTP_USER=apikey`, `SMTP_PASSWORD=<SendGrid API key>`.

Apply:

```powershell
docker compose up -d --force-recreate backend
```

Important: `docker compose restart backend` does **not** reload `env_file`.
Use `up -d --force-recreate backend` after changing `.env`.

The reset link is valid for 30 minutes, single-use, and resets revoke existing
sessions. The API always returns a generic response so it cannot reveal whether
an email is registered.

---

## 3. Stripe payments

Stripe checkout is implemented with raw REST calls (`httpx`) and manual webhook
signature verification. No Stripe SDK is required. The frontend does **not** need
a Stripe publishable key because Checkout is hosted by Stripe.

Current plan amounts are inline in `backend/app/routers/billing.py`
(`PLAN_CONFIG` around line 48):

- `pro_monthly`: 500 cents = **$5 / month**
- `pro_yearly`: 4000 cents = **$40 / year**
- Currency: **USD**

If you want different prices, edit `PLAN_CONFIG` in that file.

### Test mode setup

1. In Stripe Dashboard, turn on **Test mode**.
2. Go to **Developers → API keys** and copy the **Secret key** (`sk_test_...`).
3. Add to `backend/.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   FRONTEND_BASE_URL=http://localhost:3000
   ```

4. Start the local webhook forwarder (Stripe CLI):

   ```powershell
   stripe login
   stripe listen --forward-to localhost:8000/api/billing/webhook/stripe
   ```

5. Copy the printed signing secret (`whsec_...`) into `backend/.env`:

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

6. Apply:

   ```powershell
   docker compose up -d --force-recreate backend
   ```

7. Sign in, open `/billing`, click a Pro plan, and pay with the test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits

8. Check:
   - You are redirected back to `/billing?checkout=success`.
   - Payment appears in the billing history.
   - The user's plan becomes `pro`.

### Production webhook

In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- Endpoint URL: `https://your-domain.com/api/billing/webhook/stripe`
- Events:
  - `checkout.session.completed`
  - `invoice.paid`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

The webhook path is intentionally CSRF-exempt; it is authenticated by the
Stripe signature instead.

Expected failures:

- `503 PAYMENTS_DISABLED` from checkout → `STRIPE_SECRET_KEY` missing.
- `503 PAYMENTS_DISABLED` from webhook → `STRIPE_WEBHOOK_SECRET` missing.
- `400 STRIPE_SIGNATURE_INVALID` → wrong webhook secret, or the raw body was
  changed by a proxy.
- Payment succeeds but plan stays free → webhook not reaching the backend or
  wrong events selected.

---

## 4. Apply/verify checklist

```powershell
# Frontend only needs rebuilding for NEXT_PUBLIC_* changes (Google Client ID).
docker compose up -d --build frontend

# Backend .env changes require recreating the container (not just restart).
docker compose up -d --force-recreate backend

# Verify services and pages
docker compose ps
Invoke-WebRequest http://localhost:8000/health -UseBasicParsing
Invoke-WebRequest http://localhost:3000/login -UseBasicParsing
```

After everything works, update `plan_fornt_worklog.md` and tick the remaining
credential smoke tests.
