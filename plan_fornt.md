# Scholario — Frontend Trust, Accounts & Payments Plan

> **File:** `plan_fornt.md` · **Owner:** engineering · **Created:** 2026-11-08
>
> **Roman Urdu summary (short):** Ye plan batata hai ke hum Scholario ko kaise
> zyada trustworthy banayenge: (1) landing page ko senior-level, trust-building
> page bana kar, (2) registration / sign in / sign up / forgot password / Google
> sign-in ko properly secure bana kar, aur (3) Stripe payments integrate karne
> ka. Har phase ke baad `plan_fornt_worklog.md` update hoga — us file se pata
> chalega kya ho gaya aur kya reh gaya. Agar kaam beech mein ruke to
> `plan_fornt_worklog.md` ka "Resume here" section dekhein.

---

## 0. Platform understanding (current state)

Scholario is a scholarship discovery and application workspace for students,
mainly from Pakistan. The product is a **FastAPI (SQLAlchemy) backend + Next.js
App Router frontend**.

What exists today:

- 9,338 scholarship rows imported from CSV, 844 universities, host-country map,
  IELTS/GPA tier matcher, onboarding, matched results, saved, tracker, checklist,
  templates, AI advisor (mock), admin and consultant panels.
- Auth: email + password registration/login, JWT access + refresh cookies,
  CSRF double-submit protection, refresh-token rotation/reuse detection, access
  token denylist, login lockout, optional TOTP for staff.
- Public frontend: a minimal landing page (`/`), `/how-it-works`, `/login`,
  `/register`. No forgot-password, no email verification, no Google sign-in.
- Billing: `GET /api/billing/plans`, but checkout is disabled (`503
  PAYMENTS_DISABLED`); `docs/PAYMENTS.md` is only a stub.

Gaps this plan closes:

1. Landing page is too thin to earn trust (no proof, pricing, FAQ, security,
   legal pages, no live data).
2. No account recovery, no OAuth, weak registration UX (no password visibility,
   no strength meter, no terms consent).
3. No payment provider integration (Stripe was requested).

---

## 1. Goals & success criteria

### Goals

1. **Trust:** a visitor should understand *what Scholario does, who it is for,
   where data comes from, what is free, and how their data is protected* within
   the first screen, and have every "is this real?" question answered before the
   final CTA.
2. **Accounts:** a complete, secure account lifecycle — register, verify
   (optional but wired), sign in, sign out everywhere, forgot password, reset
   password, Google sign-in/sign-up.
3. **Payments:** real Stripe Checkout + verified webhooks that upgrade a user to
   Pro; nothing is trusted from the browser.

### Success criteria

- Landing page has the sections in §2, loads fast, is mobile-first, and has no
  fabricated social proof.
- A user can recover a forgotten password end-to-end (email stub in dev).
- A user can sign in/up with Google (when `GOOGLE_CLIENT_ID` is configured).
- A user can open Stripe Checkout and, after a signed webhook, becomes Pro;
  replayed events do not double-charge or double-upgrade.
- `npm run lint`, `npm run build`, `ruff check`, and `pytest` stay green.

---

## 2. Landing page specification

### 2.1 How long should it be?

A good trust-focused SaaS/education landing page is **not** measured in pixels —
it is measured in questions answered. For Scholario:

- **8–10 content sections + header + footer.**
- Roughly **1,200–1,800 words of visible copy**, about **6–9 mobile screen
  scrolls**. Long enough to answer objections, short enough that the CTA is
  never far away.
- The hero must answer *what / who / why now / what next* above the fold.
- Every scroll should end near a CTA (hero, after "how it works", after pricing,
  final CTA).

### 2.2 Sections (in order)

| # | Section | Purpose / trust job |
|---|---------|---------------------|
| 0 | **Public header** (sticky) | Brand, How it works, Pricing, FAQ, About; Log in + Create account. |
| 1 | **Hero** | Headline + subhead + primary/secondary CTA. Trust bullets: "9,338 scholarships", "844 universities", "Explainable matching", "Free to start". Product preview visual. |
| 2 | **Live proof bar** | Real counters from `GET /api/public/stats`: active scholarships, universities, countries. Label the data source and "estimates". |
| 3 | **The problem** | Short empathy block: too many lists, unclear eligibility, missed deadlines. Sets up the product. |
| 4 | **How it works (3 steps)** | Profile → explained shortlist → track & apply. Link to `/how-it-works`. |
| 5 | **Why you can trust us** | Transparency: real eligibility rules, every estimate labelled, source/deadline shown, no pay-to-win ranking, no hidden fees. |
| 6 | **Featured opportunities** | 3 real active scholarships from `GET /api/public/featured`, with country, level, funding, deadline. |
| 7 | **The workspace** | Save, tracker, checklist from required documents, templates/SOP, AI advisor, reminders. |
| 8 | **Security & privacy** | HTTPS, hashed passwords, email verification, password reset tokens expire, "you can export/delete your data". Link to privacy policy. |
| 9 | **Pricing** | Free vs Pro with an honest "what Free includes". CTA to `/register` and `/billing`. |
| 10 | **FAQ** | 6–8 real objections: Is it free? Are these real scholarships? Do you guarantee admission? Do you sell data? Can I use it without IELTS? How does matching work? Can I cancel? |
| 11 | **Final CTA** | One clear action, no form. |
| 12 | **Footer** | How it works, Pricing, FAQ, Privacy, Terms, Refund policy, Contact, staff logins, copyright, contact email. |

### 2.3 Trust rules (non-negotiable)

- **No fake testimonials or logos.** If real stories do not exist yet, use a
  "Our commitments" block instead. Fabricated proof destroys trust.
- Every number that is an estimate says **"estimate"**.
- Never say "guaranteed scholarship/admission". Say "opportunities that fit your
  profile", "eligibility rules", "chance estimates".
- Show a real support email and real legal pages before asking for payment.

### 2.4 Performance, SEO, accessibility

- Server-rendered landing page (`app/page.tsx`), live data fetched server-side
  with a safe fallback so the build never depends on a running backend.
- Metadata: title, description, Open Graph, canonical.
- Semantic landmarks (`header`, `main`, `section`, `footer`), labelled nav,
  visible focus, alt text, `prefers-reduced-motion` respected.
- No layout shift from stats (fixed min-height).

---

## 3. Accounts & authentication specification

### 3.1 Registration

- Fields: full name, email, password, confirm password, accept Terms + Privacy.
- Client + server validation (zod-like manual checks; Pydantic on server).
- Password: min 8 chars, show strength meter, show/hide toggle.
- Referral code from `?ref=` still supported.
- On success: session cookie set (existing behaviour) → `/onboarding`.
- Server-side: rate limit, duplicate-email check, no email enumeration leaks.

### 3.2 Email verification (wired, optional enforcement)

- Add `email_verification_tokens` (or reuse a generic token table).
- On register, create a verification token and send a link (console/SMTP).
- `POST /api/auth/verify-email` marks `is_verified`.
- Enforcement policy stays permissive by default (flag
  `REQUIRE_EMAIL_VERIFICATION=false`); documented, not silently blocking.

### 3.3 Sign in

- Existing `/api/auth/login` stays the student endpoint.
- Improve UX: password visibility, inline errors, "forgot password" link,
  Google button, safe `next` redirect (already implemented).
- Keep lockout + rate limits.

### 3.4 Forgot / reset password (new)

Flow:

1. `/forgot-password` → `POST /api/auth/forgot-password {email}`.
   - Always returns the same generic message (no account enumeration).
   - Rate limited. Invalidates previous unused tokens for that user.
   - Creates a 32-byte random token, stores **only its SHA-256 hash**, expiry
     **30 minutes**, `used=false`.
   - Sends a link `{FRONTEND_BASE_URL}/reset-password?token=...` via the email
     service (console stub in dev).
2. `/reset-password?token=...` → `POST /api/auth/reset-password {token,
   password}`.
   - Verifies hash + expiry + unused, updates password, marks token used,
     revokes all refresh tokens, increments `token_version`.
   - User is asked to sign in again.
3. Tokens are single-use and expire; responses never reveal whether an email
   exists.

### 3.5 Google sign-in / sign-up (new)

- Frontend: Google Identity Services (`accounts.google.com/gsi/client`) button.
  Loads `GOOGLE_CLIENT_ID` from `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- `POST /api/auth/google {credential}` (ID token).
- Backend verifies the ID token with Google's `tokeninfo` endpoint via `httpx`:
  - `aud` must equal `GOOGLE_CLIENT_ID`.
  - `email_verified` must be true.
  - `sub` and `email` required.
- Upsert: find by `google_sub`, else by email; link or create a `student` user
  with `is_verified=true` and a random password hash (password login stays
  impossible until the user sets one).
- Issues the same access/refresh cookies through the shared `_set_session`.
- If `GOOGLE_CLIENT_ID` is not configured, the endpoint returns `503
  GOOGLE_AUTH_DISABLED` and the button is hidden/disabled.

### 3.6 Session / security controls

- Keep access 30 min + refresh 14 days, httpOnly, SameSite=Lax, Secure in prod.
- Keep CSRF double-submit for all unsafe methods **except provider webhooks**.
- Keep refresh-token rotation/reuse detection and the access-token denylist.
- Password reset and password change must revoke all sessions.
- Never log passwords, tokens, or ID tokens.

---

## 4. Payments (Stripe) specification

> The user asked for Stripe. We integrate **Stripe Checkout** (hosted) so card
> data never touches our servers. Implementation is provider-neutral in spirit but
> Stripe is the first provider.

### 4.1 Plans

| Plan id | Price | Interval | Grants |
|---|---|---|---|
| `free` | $0 | — | default |
| `pro_monthly` | $5 | month | `plan=pro`, `plan_expires_at=+1 month` |
| `pro_yearly` | $40 | year | `plan=pro`, `plan_expires_at=+1 year` |

Prices live in the backend `billing` router (already there). Amounts are sent to
Stripe as `price_data` in cents, so no dashboard Price objects are required.

### 4.2 Checkout

- `POST /api/billing/checkout {plan}` (authenticated).
- If `STRIPE_SECRET_KEY` is unset → `503 PAYMENTS_DISABLED`.
- Creates a Checkout Session via Stripe REST (`httpx`, form-encoded) with
  `mode=subscription`, `price_data`, `client_reference_id=user.id`,
  `metadata[user_id]`, `metadata[plan]`, success/cancel URLs.
- Returns `{url}`; frontend redirects. **Never** mark the user Pro here.

### 4.3 Webhook

- `POST /api/billing/webhook/stripe` — **public**, **CSRF-exempt**, raw body.
- Verifies `Stripe-Signature` (`t=…,v1=…`) with `STRIPE_WEBHOOK_SECRET` using
  HMAC-SHA256 over `"{t}.{payload}"`, 5-minute tolerance.
- On `checkout.session.completed` (and `invoice.paid` when available):
  - Resolve `user_id` from metadata / `client_reference_id`.
  - Upsert a `payments` row keyed by unique `provider_ref` (idempotent).
  - Only if the payment was not already `succeeded`, set `plan=pro` and
    `plan_expires_at`.
- Replayed/unknown events return `200` without side effects.
- `GET /api/billing/history` lists the user's payments.
- `GET /api/billing/plans` returns `checkout_enabled = bool(STRIPE_SECRET_KEY)`.

### 4.4 Data model (new)

`payments`: `id, user_id, provider('stripe'), provider_ref (unique), amount,
currency, plan, status, raw_json, created_at, updated_at`.

### 4.5 Configuration

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_BASE_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_ID=
```

Local webhook testing: `stripe listen --forward-to localhost:8000/api/billing/webhook/stripe`.

### 4.6 Production procedure (summary; full steps in `docs/PAYMENTS.md`)

1. Create Stripe account + activate business.
2. Add test keys, then live keys, to backend env only.
3. Add the webhook endpoint in the Stripe dashboard (or `stripe listen` locally).
4. Add legal pages (privacy, terms, refund policy) + support email — required for
   a credible checkout.
5. Test: successful card `4242 4242 4242 4242`, declined card, cancelled
   checkout, replayed webhook.
6. Verify the plan upgrade and `plan_expires_at` in the DB.
7. Enable the live key, re-test with a real low-value purchase, monitor.

---

## 5. Backend work breakdown

| Area | File(s) | Change |
|---|---|---|
| Public data | `app/routers/public.py` (new), `app/main.py` | `GET /api/public/stats`, `GET /api/public/featured` |
| Email | `app/services/email.py` (new) | SMTP or console stub; `send_password_reset`, `send_verification` |
| Password reset | `app/models/user.py`, `app/routers/auth.py`, `app/schemas/user.py` | token model, forgot/reset endpoints, token helpers |
| Google | `app/routers/auth.py`, `app/schemas/user.py`, `app/models/user.py` | `google_sub` column, `POST /api/auth/google` |
| Payments | `app/models/payment.py` (new), `app/routers/billing.py`, `app/main.py` | model, checkout, webhook, history, CSRF exemption |
| Migration | `alembic/versions/0013_accounts_payments.py` (new) | columns + tables |
| Config | `backend/.env.example` | new env vars |

## 6. Frontend work breakdown

| Area | File(s) | Change |
|---|---|---|
| Shared public UI | `src/components/PublicHeader.tsx`, `PublicFooter.tsx` (new) | one consistent, trustworthy header/footer |
| Landing | `src/app/page.tsx`, `src/app/globals.css` | full trust-focused page, new section styles |
| Server data | `src/lib/serverApi.ts` (new) | safe server fetch with fallback |
| Auth | `src/app/login/page.tsx`, `register/page.tsx` | visibility toggle, strength, terms, forgot link, Google |
| Recover | `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` | new pages |
| Google | `src/components/GoogleButton.tsx` (new) | GIS button, posts credential |
| Legal | `src/app/privacy`, `terms`, `refund-policy`, `contact` | real, readable policies |
| Billing | `src/app/(student)/billing/page.tsx` | call checkout, redirect to Stripe |
| API client | `src/lib/api.ts` | no change to token logic; add helpers only if needed |

---

## 7. Design system rules

- Reuse existing tokens: `--teal #1b5e5a`, `--deep-teal`, `--paper #f5f3e9`,
  `--ink`, `--muted`, `--line`, `--lime #dfb55d`.
- Typography: DM Sans + DM Serif Display (already loaded).
- Rounded cards, soft shadows, generous spacing, mobile-first breakpoints.
- New classes must be prefixed (e.g. `lp-`) to avoid clashing with existing
  workspace styles.
- Respect `prefers-reduced-motion`.

---

## 8. Environments / configuration

Backend (`backend/.env`):

```dotenv
FRONTEND_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Scholario <no-reply@scholario.ai>"
REQUIRE_EMAIL_VERIFICATION=false
```

Frontend (`frontend/.env.local`):

```dotenv
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

Secrets never go in `NEXT_PUBLIC_*` except the Google **client id** (public by
design).

---

## 9. Testing & verification

- Backend: `ruff check app`; `pytest` (add tests for reset tokens, public stats,
  Stripe signature verification and idempotent webhook).
- Frontend: `npm run lint`; `npm run build`.
- Manual: register → onboarding; forgot → reset → sign in; Google (if key);
  checkout with Stripe test card; replay webhook.
- Accessibility: keyboard tab order on landing + auth; contrast on teal/gold.

---

## 10. Risks & decisions

| Risk | Mitigation |
|---|---|
| Fake trust signals backfire | No fabricated testimonials/logos; use commitments + verifiable data. |
| Email provider not configured | Console/dev stub; configurable SMTP; generic responses. |
| Google tokeninfo network failure | Return clear `503`/`502`; catch and log; button disabled if unconfigured. |
| Stripe webhook blocked by CSRF | Exempt only `/api/billing/webhook/*`; verify signature instead. |
| Build fails without backend | Server fetch wrapped with fallback; landing renders static-safe. |
| Duplicate webhook deliveries | Unique `provider_ref` + status check → idempotent. |
| Existing styles regression | New `lp-`/auth classes appended; no rewrites of workspace CSS. |

---

## 11. Execution phases (order)

1. **Phase 0 — Docs:** this plan + `plan_fornt_worklog.md`. ✅
2. **Phase 1 — Landing page:** public endpoints, shared header/footer, new
   landing page + CSS, legal pages.
3. **Phase 2 — Accounts:** forgot/reset password (model, endpoints, pages),
   email service, registration/login UX upgrades.
4. **Phase 3 — Google:** `google_sub` + `/api/auth/google` + Google button.
5. **Phase 4 — Stripe:** payment model, checkout, webhook, history, billing page,
   `docs/PAYMENTS.md` procedure.
6. **Phase 5 — Verify:** lint/build/tests, manual smoke, update worklog.

> **Resume policy:** at any stop, open `plan_fornt_worklog.md` → "Resume here".
> Do the next unchecked item, then update the worklog.

---

## 12. Definition of done

- [ ] Landing page has §2 sections, real live counters/featured data, legal
      links, and no fabricated proof.
- [ ] Forgot/reset password works end-to-end.
- [ ] Google sign-in works when configured and degrades safely when not.
- [ ] Stripe checkout + signed webhook upgrade Pro exactly once.
- [ ] Lint, typecheck/build, and backend tests pass.
- [ ] `plan_fornt_worklog.md` reflects the true state.
