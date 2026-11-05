"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Referral = { code: string; link: string; invited: number; reward_threshold: number; reward_description: string };

export default function ReferralPage() {
  const [referral, setReferral] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Referral>("/api/referral").then(setReferral).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load referral details.")); }, []);
  async function copyLink() {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy automatically. Please copy the link manually.");
    }
  }
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A GOOD THING, PASSED ALONG</p><h1>Invite a fellow student.</h1><p className="page-subtitle">Share a calmer place to plan scholarship applications.</p></div></section>{error && <p className="form-error" role="alert">{error}</p>}{referral && <section className="referral-panel"><span className="quick-icon gold"><UserPlus size={20} /></span><p className="eyebrow">YOUR INVITE LINK</p><strong>{referral.code}</strong><div className="referral-link"><span>{referral.link}</span><button className="outline-button" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy link"}</button></div><div className="referral-progress"><div><span>Invitations</span><strong>{referral.invited} / {referral.reward_threshold}</strong></div><span className="chance-bar"><span style={{ width: `${Math.min(referral.invited / referral.reward_threshold * 100, 100)}%` }} /></span><p>{referral.reward_description}</p></div></section>}</div>;
}