"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Link2Off } from "lucide-react";
import AuthGate, { AuthLink, AuthSwitchLink } from "@/components/AuthGate";
import { ApiError, apiFetch } from "@/lib/api";
import { PASSWORD_STRENGTH_LABELS, passwordScore } from "@/lib/password";

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasToken = token.length >= 16;
  const score = passwordScore(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.code === "INVALID_TOKEN" || cause.status === 400)) {
        setError("This reset link is invalid or has expired. Please request a new one.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not reset your password.");
      }
    } finally {
      setBusy(false);
    }
  }

  let eyebrow = "RESET PASSWORD";
  let title = "Choose a new password";
  let subtitle = "Use at least 8 characters and avoid passwords you use elsewhere.";

  if (done) {
    eyebrow = "PASSWORD UPDATED";
    title = "You're all set";
    subtitle = "Sign in with your new password to continue.";
  } else if (!hasToken) {
    eyebrow = "LINK PROBLEM";
    title = "This link won't work";
    subtitle = "Request a fresh link and try again.";
  }

  return (
    <AuthGate
      kicker="SECURE BY DEFAULT"
      headline={
        <>
          One new password.
          <br />
          A clean <em>fresh start.</em>
        </>
      }
      copy="Choose something you do not use elsewhere. The link works once, then your other sessions are signed out."
      points={[
        "At least 8 characters",
        "Link expires after 30 minutes",
        "Other sessions signed out",
      ]}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      switchLine={
        <AuthSwitchLink
          href="/login"
          direction="left"
          label={done ? "Ready to continue?" : "Remembered it?"}
          cta="Sign in"
        />
      }
    >
      {done ? (
        <div className="authgate-success">
          <span className="authgate-success-icon">
            <CheckCircle2 size={24} />
          </span>
          <p className="authgate-success-copy">
            Your password has been changed and other sessions were signed out.
          </p>
          <p className="authgate-success-note">
            Sign in with your new password to pick up where you left off.
          </p>
        </div>
      ) : !hasToken ? (
        <div className="authgate-success authgate-success-warn">
          <span className="authgate-success-icon">
            <Link2Off size={22} />
          </span>
          <p className="authgate-success-copy">The reset link is missing or incomplete.</p>
          <p className="authgate-success-note">
            Reset links expire after 30 minutes and can only be used once.
          </p>
          <AuthLink className="authgate-secondary" href="/forgot-password" direction="left">
            Request a new link
          </AuthLink>
        </div>
      ) : (
        <form onSubmit={submit} className="authgate-form">
          <label className="authgate-field">
            <span>New password</span>
            <span className="authgate-password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
            <span className="strength" data-score={password ? score : 0}>
              <span className="strength-bars" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              <span className="input-hint">
                {password ? PASSWORD_STRENGTH_LABELS[score] : "Use 8 or more characters."}
              </span>
            </span>
          </label>

          <label className="authgate-field">
            <span>Confirm new password</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your new password"
            />
          </label>

          {error && (
            <p className="authgate-error" role="alert">
              {error}
            </p>
          )}

          <button className="authgate-submit" disabled={busy}>
            <span>{busy ? "Saving..." : "Reset password"}</span>
            <ArrowRight size={17} />
          </button>
        </form>
      )}
    </AuthGate>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="authgate-viewport">
          <p className="authgate-loading">Checking your reset link...</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
