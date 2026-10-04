# Payments

Billing starts as a disabled provider-neutral skeleton. The intended interface creates a checkout URL and verifies provider webhooks. The server must verify webhook signatures, make event handling idempotent using a unique provider reference, and never trust frontend-reported payment success.

Stripe is the international-card option. Safepay, JazzCash, Easypaisa, and PayFast Pakistan are documented alternatives. Manual bank transfer can be reviewed by an admin. Keys and webhook secrets stay in backend environment variables; payment records and plan changes are written server-side. No checkout is active in the initial scaffold.