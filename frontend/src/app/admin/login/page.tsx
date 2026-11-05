"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApiError, apiFetch, resetSessionCache } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password, totp_code: totpCode || undefined }),
      });
      resetSessionCache();
      router.replace("/admin/dashboard");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "MFA_REQUIRED") {
        setNeedsTotp(true);
        setError("Enter the 6-digit code from your authenticator app.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not sign in.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <Link href="/" className="admin-login-brand">
        <Image
          className="brand-logo"
          src="/images/logo/logo.png"
          alt="Scholario"
          width={39}
          height={36}
          priority
        />
        scholario<span className="brand-period">.</span>
        <span className="admin-login-role">SUPER ADMIN</span>
      </Link>
      <section>
        <p className="admin-eyebrow">RESTRICTED AREA</p>
        <h1>Super admin sign in</h1>
        <p>Full platform access: consultants, scholarships, users and settings.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {needsTotp && (
            <label>
              Authenticator code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                placeholder="123456"
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
            <ArrowRight size={15} />
          </button>
        </form>
        <p className="admin-login-alt">
          Consultant? <Link href="/consultant/login">Go to consultant sign in</Link>
        </p>
      </section>
    </main>
  );
}
