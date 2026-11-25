"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import AuthGate, { AuthLink, AuthSwitchLink } from "@/components/AuthGate";
import GoogleButton from "@/components/GoogleButton";
import { ApiError, apiFetch, resetSessionCache } from "@/lib/api";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const verified = searchParams.get("verified") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setForbidden(false);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      resetSessionCache();
      const next = searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
          ? next
          : "/dashboard";
      router.replace(safeNext);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "AUTH_FORBIDDEN") setForbidden(true);
      if (cause instanceof ApiError && cause.code === "EMAIL_NOT_VERIFIED") {
        setError("Please verify your email before signing in. Check your inbox for the code.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not sign in.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate
      mobileAlign="center"
      kicker="SCHOLARSHIP MATCHING"
      headline={
        <>
          Your plans,
          <br />
          with fewer
          <br />
          <em>blind spots.</em>
        </>
      }
      copy="Matching built on eligibility, deadlines, and fit — so every application starts from a clear position."
      points={[
        "Eligibility checked before ranking",
        "Requirements and deadlines in one place",
        "Free to start, no IELTS needed",
      ]}
      eyebrow="WELCOME BACK"
      title="Sign in to Scholario"
      subtitle="Pick up where your applications left off."
      switchLine={
        <AuthSwitchLink
          href="/register"
          direction="right"
          label="New to Scholario?"
          cta="Create an account"
        />
      }
    >
      <form onSubmit={submit} className="authgate-form">
        <label className="authgate-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="authgate-field">
          <span className="authgate-label-row">
            Password
            <AuthLink className="authgate-forgot" href="/forgot-password" direction="left">
              Forgot password?
            </AuthLink>
          </span>
          <span className="authgate-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
            <button
              type="button"
              className="authgate-eye"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        {verified && (
          <p className="authgate-success-note" role="status">
            Email verified. You can sign in now.
          </p>
        )}
        {error && (
          <p className="authgate-error" role="alert">
            {error}
          </p>
        )}
        {forbidden && (
          <p className="authgate-staff">
            Staff or administrator? <Link href="/admin/login">Super admin</Link> or{" "}
            <Link href="/consultant/login">consultant</Link> sign in.
          </p>
        )}

        <button className="authgate-submit" disabled={busy}>
          <span>{busy ? "Signing in..." : "Sign in"}</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <GoogleButton mode="signin" />
    </AuthGate>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="authgate-viewport">
          <p className="authgate-loading">Loading sign in...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
