"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import AuthGate, { AuthSwitchLink } from "@/components/AuthGate";
import GoogleButton from "@/components/GoogleButton";
import { apiFetch, resetSessionCache } from "@/lib/api";
import { PASSWORD_STRENGTH_LABELS, passwordScore } from "@/lib/password";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const score = passwordScore(form.password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the terms and privacy policy to continue.");
      return;
    }
    setBusy(true);
    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref") || undefined;
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...form, referral_code: referralCode }),
      });
      resetSessionCache();
      router.replace("/onboarding");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate
      kicker="ACCOUNT SETUP"
      headline={
        <>
          Start with
          <br />
          your <em>story.</em>
        </>
      }
      copy="Create an account to find scholarships shaped around your goals, background, and eligibility."
      points={[
        "Recommendations based on your profile",
        "Clear eligibility and deadlines",
        "Free to start, no IELTS needed",
      ]}
      eyebrow="CREATE ACCOUNT"
      title="Create your Scholario account"
      subtitle="A few details, then we'll shape your shortlist."
      switchLine={
        <AuthSwitchLink
          href="/login"
          direction="left"
          label="Already have an account?"
          cta="Sign in"
        />
      }
    >
      <form onSubmit={submit} className="authgate-form">
        <label className="authgate-field">
          <span>Full name</span>
          <input
            autoComplete="name"
            required
            minLength={1}
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder="Your name"
          />
        </label>
        <label className="authgate-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
          />
        </label>
        <label className="authgate-field">
          <span>Password</span>
          <span className="authgate-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="At least 8 characters"
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
          <span className="strength" data-score={form.password ? score : 0}>
            <span className="strength-bars" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            <span className="input-hint">
              {form.password ? PASSWORD_STRENGTH_LABELS[score] : "Use 8 or more characters."}
            </span>
          </span>
        </label>
        <label className="authgate-field">
          <span>Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
          />
        </label>
        <label className="authgate-check">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span>
            I agree to the <Link href="/terms">terms of service</Link> and{" "}
            <Link href="/privacy">privacy policy</Link>.
          </span>
        </label>
        {error && (
          <p className="authgate-error" role="alert">
            {error}
          </p>
        )}
        <button className="authgate-submit" disabled={busy}>
          <span>{busy ? "Creating account..." : "Create account"}</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <GoogleButton mode="signup" />
    </AuthGate>
  );
}
