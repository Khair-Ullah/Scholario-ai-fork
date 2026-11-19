"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Receipt } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price_monthly: number | null;
  price_yearly: number | null;
  currency?: string;
  features: string[];
};
type Billing = { plans: Plan[]; current_plan: string; checkout_enabled: boolean };
type PaymentRow = {
  id: number;
  provider: string;
  reference: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  created_at: string | null;
};

function formatAmount(dollars: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function BillingContent() {
  const checkoutState = useSearchParams().get("checkout");
  const notice =
    checkoutState === "success"
      ? "Payment received. Your plan updates as soon as the provider confirms it — refresh in a moment."
      : checkoutState === "cancelled"
        ? "Checkout was cancelled. You have not been charged."
        : "";
  const [billing, setBilling] = useState<Billing | null>(null);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Billing>("/api/billing/plans")
      .then(setBilling)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Could not load plan details."),
      );
    apiFetch<PaymentRow[]>("/api/billing/history")
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  async function checkout(plan: Plan) {
    setPending(plan.id);
    setError("");
    try {
      const result = await apiFetch<{ url?: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: plan.id }),
      });
      if (!result.url) throw new Error("The payment provider did not return a checkout link.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setPending("");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">A PLAN THAT FITS YOUR PACE</p>
          <h1>Plan &amp; billing.</h1>
          <p className="page-subtitle">
            {billing?.checkout_enabled
              ? "Upgrade securely through Stripe. Cancel any time from this page."
              : "Checkout is not enabled until a payment provider is configured."}
          </p>
        </div>
        <span className="plan-chip">Current: {billing?.current_plan || "…"}</span>
      </section>

      {notice && (
        <p className="billing-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="billing-grid">
        {billing?.plans.map((plan) => {
          const isCurrent =
            plan.id === billing.current_plan ||
            (billing.current_plan === "pro" && plan.id.startsWith("pro"));
          const isFree = plan.id === "free";
          const price = plan.price_yearly ?? plan.price_monthly;
          const suffix = plan.price_yearly ? " / year" : plan.price_monthly ? " / month" : "";
          return (
            <article className="billing-plan" key={plan.id}>
              <p className="eyebrow">
                {plan.id.includes("yearly")
                  ? "ANNUAL"
                  : plan.id.includes("monthly")
                    ? "MONTHLY"
                    : "START HERE"}
              </p>
              <h2>{plan.name}</h2>
              <strong className="billing-price">
                {price ? formatAmount(price, plan.currency) : "$0"}
                <small>{suffix}</small>
              </strong>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className="outline-button"
                disabled={isFree || isCurrent || !billing.checkout_enabled || pending === plan.id}
                onClick={() => checkout(plan)}
              >
                <CreditCard size={14} />
                {isFree
                  ? "Included"
                  : isCurrent
                    ? "Current plan"
                    : pending === plan.id
                      ? "Redirecting..."
                      : billing.checkout_enabled
                        ? "Choose plan"
                        : "Checkout unavailable"}
              </button>
            </article>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="billing-history">
          <p className="eyebrow">PAYMENT HISTORY</p>
          <h2>
            <Receipt size={18} /> Recent receipts
          </h2>
          <div className="billing-history-list">
            {history.map((row) => (
              <div className="billing-history-row" key={row.id}>
                <div>
                  <strong>{formatAmount(row.amount, row.currency)}</strong>
                  <span>{row.plan.replaceAll("_", " ")}</span>
                </div>
                <div>
                  <span className="billing-status" data-status={row.status}>
                    {row.status}
                  </span>
                  <span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="page-stack">
          <section className="page-heading">
            <div>
              <p className="eyebrow">A PLAN THAT FITS YOUR PACE</p>
              <h1>Plan &amp; billing.</h1>
              <p className="page-subtitle">Loading plan details...</p>
            </div>
          </section>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
