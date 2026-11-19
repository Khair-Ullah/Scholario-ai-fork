# Payments

Scholario uses **Stripe Checkout** for international card payments. Billing is
provider-neutral at the database level: the server creates the checkout session,
verifies the webhook signature, and is the only place that upgrades a user's
plan. The browser is never trusted to report a successful payment.

The backend talks to Stripe through the REST API with `httpx` (no `stripe` SDK)
and verifies webhook signatures with HMAC-SHA256.

---

## 1. How a payment flows

1. The student opens `/billing`. `GET /api/billing/plans` returns the plans and
   `checkout_enabled` (true only when `STRIPE_SECRET_KEY` is set).
2. The student clicks **Choose plan**. The browser calls
   `POST /api/billing/checkout` with `{ "plan": "pro_monthly" }`.
3. The backend creates a Stripe Checkout Session in `subscription` mode, with:
   - `success_url = {FRONTEND_BASE_URL}/billing?checkout=success`
   - `cancel_url  = {FRONTEND_BASE_URL}/billing?checkout=cancelled`
   - `client_reference_id` and metadata containing the user id and plan
   - inline `price_data` (currency `usd`, recurring interval)
4. The API returns `{ "url", "id" }` and the browser redirects to Stripe.
5. After payment, Stripe calls `POST /api/billing/webhook/stripe`.
6. The backend verifies `Stripe-Signature`, records the payment idempotently,
   and sets `user.plan = "pro"` plus `user.plan_expires_at`.
7. The student returns to `/billing?checkout=success`. The page shows a notice;
   the plan is authoritative on the server.
8. `GET /api/billing/history` powers the receipts list.

The redirect alone never upgrades the account. If the webhook is delayed or
replayed, the plan is still not changed twice.

---

## 2. Plans

| Plan id       | Name         | Price    | Interval | Duration set on user |
|---------------|--------------|----------|----------|----------------------|
| `free`        | Free         | $0       | —        | —                    |
| `pro_monthly` | Pro monthly  | $5.00    | month    | 31 days              |
| `pro_yearly`  | Pro yearly   | $40.00   | year     | 365 days             |

Both paid plans set `user.plan = "pro"`. The billing interval is kept in the
`payments.plan` column and in Stripe metadata. `is_pro()` treats an expired
`plan_expires_at` as free.

---

## 3. Environment variables

Backend (`backend/.env`):

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes for checkout | `sk_test_...` or `sk_live_...`. Presence enables checkout. |
| `STRIPE_WEBHOOK_SECRET` | yes for webhooks | `whsec_...` from the webhook endpoint or Stripe CLI. |
| `FRONTEND_BASE_URL` | recommended | Public site origin used for success/cancel URLs. Default `http://localhost:3000`. |

Frontend (`frontend/.env.local`):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Backend origin (for example `http://localhost:8000`). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | for Google | Enables the Google button. Unrelated to Stripe. |

Never commit either secret. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
must only exist in the backend environment.

---

## 4. API reference

### `GET /api/billing/plans`
Authenticated. Returns:

```json
{ "plans": [...], "current_plan": "free", "checkout_enabled": true }
```

### `POST /api/billing/checkout`
Authenticated, rate limited to 10/minute. Body:

```json
{ "plan": "pro_monthly" }
```

Responses:
- `200 { "url": "https://checkout.stripe.com/...", "id": "cs_..." }`
- `400 PLAN_UNKNOWN` — plan id not in `PLAN_CONFIG`
- `502 PAYMENT_UNAVAILABLE` / `PAYMENT_ERROR` — Stripe unreachable/rejected
- `503 PAYMENTS_DISABLED` — `STRIPE_SECRET_KEY` not set

### `POST /api/billing/webhook/stripe`
No auth cookie. Verified by signature only. CSRF middleware skips paths starting
with `/api/billing/webhook/`. Handled events:

- `checkout.session.completed` — records the Checkout Session id and upgrades.
- `invoice.paid` — records the invoice id for renewals and upgrades.

Metadata is read from `metadata`, then `subscription_details.metadata`, then
`parent.subscription_details.metadata` (Stripe API versions moved subscription
metadata around).

Responses:
- `200 { "received": true }`
- `400 STRIPE_SIGNATURE_INVALID` / `STRIPE_PAYLOAD_INVALID`
- `503 PAYMENTS_DISABLED` — `STRIPE_WEBHOOK_SECRET` not set

### `GET /api/billing/history`
Authenticated. Returns up to 50 payments, newest first:

```json
[{
  "id": 1,
  "provider": "stripe",
  "reference": "cs_test_...",
  "amount": 5.0,
  "currency": "usd",
  "plan": "pro_monthly",
  "status": "succeeded",
  "created_at": "2026-11-08T10:00:00+00:00"
}]
```

---

## 5. Local development (test mode)

1. Create a Stripe account and switch the dashboard to **Test mode**.
2. Copy the test secret key into `backend/.env`:
   `STRIPE_SECRET_KEY=sk_test_...`
3. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward
   events to the local API:

   ```bash
   stripe listen --forward-to http://localhost:8000/api/billing/webhook/stripe
   ```

4. Copy the printed `whsec_...` into `backend/.env` as
   `STRIPE_WEBHOOK_SECRET` and restart the backend.
5. Start the frontend and backend, sign in, open `/billing`, and pay with the
   test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
6. Confirm the CLI shows `checkout.session.completed` and that
   `GET /api/billing/history` has a `succeeded` row.

You can also trigger an event without paying:

```bash
stripe trigger checkout.session.completed
```

Note: a bare trigger may not carry your `user_id` metadata, so it may not
upgrade a real account. Use a real test checkout for the end-to-end check.

---

## 6. Production setup

1. Complete Stripe account activation and switch to **Live mode**.
2. Add the live secret key to the backend environment as `STRIPE_SECRET_KEY`.
3. In Stripe **Developers → Webhooks → Add endpoint**, register:

   ```
   https://<your-api-domain>/api/billing/webhook/stripe
   ```

   Subscribe to `checkout.session.completed` and `invoice.paid`.
4. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Set `FRONTEND_BASE_URL` to the public frontend origin, for example
   `https://scholario.ai`. Success and cancel URLs depend on it.
6. Apply the database migration before the first checkout:

   ```bash
   alembic upgrade head
   ```

7. Make sure the API is reachable over HTTPS. Stripe will not deliver webhooks
   to plain HTTP hosts in production.
8. Run one low-value live test (or use a Stripe test clock) and verify:
   - checkout redirects back to `/billing?checkout=success`
   - the webhook returns `200`
   - `payments` has one `succeeded` row
   - the user's plan is `pro` and `plan_expires_at` is set
   - the receipts list shows the payment

### Production checklist

- [ ] `STRIPE_SECRET_KEY` is a live key and is only on the backend.
- [ ] `STRIPE_WEBHOOK_SECRET` matches the live endpoint.
- [ ] Webhook endpoint is HTTPS and returns `200` for test deliveries.
- [ ] `FRONTEND_BASE_URL` has no trailing slash and uses the public origin.
- [ ] Migration `0013_accounts_payments` is applied.
- [ ] Refund/cancellation copy matches `/refund-policy`.
- [ ] Alerts exist for repeated webhook `400`/`503` responses.

---

## 7. Security and idempotency

- The webhook handler verifies `t=<timestamp>,v1=<signature>` with
  HMAC-SHA256 over `"{timestamp}.{raw_body}"`, and rejects timestamps older than
  300 seconds to limit replay.
- The raw request body is used for verification; do not re-serialize it.
- `payments.provider_ref` is unique and idempotency is keyed on the Stripe
  Checkout Session id / invoice id. A repeated `succeeded` event is a no-op.
- Plan changes happen only in `_record_success()`, never in the browser.
- The checkout endpoint is authenticated and rate limited.
- CSRF protection remains enabled for every other mutating route; the webhook
  is exempt because Stripe cannot send a CSRF cookie.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Button says "Checkout unavailable" | `STRIPE_SECRET_KEY` missing | Add it and restart the API. |
| `503 PAYMENTS_DISABLED` on webhook | `STRIPE_WEBHOOK_SECRET` missing | Add the signing secret. |
| `400 STRIPE_SIGNATURE_INVALID` | Wrong secret, proxy rewrote the body, or clock skew > 5 min | Use the raw body, correct secret, sync server time. |
| Paid but plan stayed free | Webhook not delivered | Check Stripe webhook logs and firewall/HTTPS. The redirect alone does not upgrade. |
| Duplicate receipt | Two different Stripe ids (session + invoice) for one checkout | Expected: one row per provider object; both are idempotent. |
| Success URL points to localhost | `FRONTEND_BASE_URL` not set | Set the public frontend origin. |

---

## 9. Alternatives (not implemented)

Regional options such as Safepay, JazzCash, Easypaisa, and PayFast Pakistan can
be added later behind the same `payments` table and the same rule: verify the
provider event server-side and key idempotency on a unique provider reference.
Manual bank transfer can be recorded by an admin with `provider = "manual"` and
a unique reference. Do not enable any of these without a verified webhook (or a
documented manual review) and a clear refund policy.
