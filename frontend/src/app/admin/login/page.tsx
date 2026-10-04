"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await apiFetch("/api/auth/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }); router.replace("/admin/dashboard"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <main className="admin-login"><Link href="/" className="admin-login-brand"><ShieldCheck size={19} /> scholario <span>ADMIN</span></Link><section><p className="admin-eyebrow">RESTRICTED AREA</p><h1>Administrator sign in</h1><p>Use your administrator account to manage the scholarship catalogue.</p><form onSubmit={submit}><label>Email<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Signing in..." : "Sign in"}<ArrowRight size={15} /></button></form></section></main>;
}