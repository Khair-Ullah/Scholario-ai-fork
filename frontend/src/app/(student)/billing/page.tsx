"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Plan = { id: string; name: string; price_monthly: number | null; price_yearly: number | null; currency?: string; features: string[] };
type Billing = { plans: Plan[]; current_plan: string; checkout_enabled: boolean };

export default function BillingPage() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Billing>("/api/billing/plans").then(setBilling).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load plan details.")); }, []);
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A PLAN THAT FITS YOUR PACE</p><h1>Plan & billing.</h1><p className="page-subtitle">Checkout is not enabled until a payment provider is configured.</p></div><span className="plan-chip">Current: {billing?.current_plan || "…"}</span></section>{error && <p className="form-error" role="alert">{error}</p>}<div className="billing-grid">{billing?.plans.map((plan) => <article className="billing-plan" key={plan.id}><p className="eyebrow">{plan.id.includes("yearly") ? "ANNUAL" : plan.id.includes("monthly") ? "MONTHLY" : "START HERE"}</p><h2>{plan.name}</h2><strong className="billing-price">{plan.price_yearly != null && plan.price_yearly > 0 ? `$${plan.price_yearly}` : plan.price_monthly ? `$${plan.price_monthly}` : "$0"}<small>{plan.price_yearly ? " / year" : plan.price_monthly ? " / month" : ""}</small></strong><ul>{plan.features.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul><button className="outline-button" disabled={!billing?.checkout_enabled || plan.id === billing.current_plan}><CreditCard size={14} />{plan.id === billing.current_plan ? "Current plan" : "Checkout unavailable"}</button></article>)}</div></div>;
}