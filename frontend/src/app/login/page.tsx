"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  return <main className="auth-layout"><Link className="brand auth-brand" href="/"><span className="brand-mark"><GraduationCap size={19} /></span> scholario<span className="brand-period">.</span></Link><Link className="back-home" href="/"><ArrowLeft size={15} /> Home</Link><section className="auth-form-wrap"><p className="eyebrow">WELCOME BACK</p><h1>Your next step<br />starts here.</h1><p className="auth-intro">Sign in to pick up where your plans left off.</p><form onSubmit={submit} className="auth-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}<ArrowRight size={16} /></button></form><p className="auth-switch">New to Scholario? <Link href="/register">Create an account</Link></p></section><div className="auth-aside"><span className="aside-index">A MORE CONSIDERED SEARCH</span><p>Good things<br />start with a<br /><em>clear next step.</em></p><span className="aside-bottom">scholario · your study, in view</span></div></main>;
}