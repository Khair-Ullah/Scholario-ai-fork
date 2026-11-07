"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSearch, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Review = { score: number; sub_scores: Record<string, number>; strengths: string[]; issues: { quote: string; problem: string; suggestion: string }[]; rewritten_intro: string; note: string; provider?: string };

export default function SopReviewerPage() {
  const [text, setText] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function runReview() {
    setBusy(true); setError(""); setReview(null);
    try { setReview(await apiFetch<Review>("/api/ai/sop-review", { method: "POST", body: JSON.stringify({ text }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review this draft."); }
    finally { setBusy(false); }
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A SECOND PAIR OF EYES</p><h1>SOP reviewer.</h1><p className="page-subtitle">Get structured feedback before you refine your draft.</p></div><Link className="outline-button" href="/templates">Open document templates <ArrowRight size={14} /></Link></section><div className="reviewer-layout"><section className="review-input"><label className="wizard-label">Your statement of purpose<textarea rows={17} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste or write your draft here. Keep personal details truthful and avoid including sensitive information." /></label><div className="review-footer"><span>{words} words</span><button className="primary-button" disabled={busy || words < 20} onClick={runReview}><Sparkles size={15} />{busy ? "Reviewing..." : "Review draft"}</button></div></section>{error && <p className="form-error" role="alert">{error}</p>}{review ? <section className="review-results"><div className="review-score"><span>{review.provider && !review.provider.startsWith("mock") ? "AI REVIEW SCORE" : "DEMO REVIEW SCORE"}</span><strong>{review.score}</strong><small>/ 100 · directional feedback only</small></div><div className="subscore-grid">{Object.entries(review.sub_scores).map(([name, score]) => <div key={name}><span>{name}</span><strong>{score}</strong></div>)}</div>{review.issues.map((issue, index) => <article className="review-issue" key={`${issue.problem}-${index}`}><strong>{issue.problem}</strong><p>{issue.suggestion}</p></article>)}<article className="review-suggestion"><FileSearch size={16} /><div><strong>Suggested direction</strong><p>{review.rewritten_intro}</p></div></article><p className="input-hint">{review.note}</p></section> : <aside className="review-empty"><FileSearch size={22} /><strong>Feedback appears here.</strong><span>Structure, clarity, goals, evidence, grammar, and program fit.</span></aside>}</div></div>;
}