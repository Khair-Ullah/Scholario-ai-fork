"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import AuthGate, { AuthSwitchLink } from "@/components/AuthGate";
import { ApiError, apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not send the reset email. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate
      mobileAlign="center"
      kicker="ACCOUNT RECOVERY"
      headline={
        <>
          A fresh start is
          <br />
          <em>one email away.</em>
        </>
      }
      copy="Request a secure link and choose a new password. The link expires in 30 minutes and can only be used once."
      points={[
        "No password needed to request a link",
        "Links expire after 30 minutes",
        "Resetting signs out your other sessions",
      ]}
      eyebrow={sent ? "CHECK YOUR INBOX" : "ACCOUNT RECOVERY"}
      title={sent ? "Reset link on the way" : "Let's get you back in"}
      subtitle={
        sent
          ? "If an account exists for that email, the link is on its way."
          : "Enter the email on your account and we will send a secure reset link."
      }
      switchLine={
        <AuthSwitchLink
          href="/login"
          direction="left"
          label="Remembered it?"
          cta="Sign in"
        />
      }
    >
      {sent ? (
        <div className="authgate-success">
          <span className="authgate-success-icon">
            <MailCheck size={22} />
          </span>
          <p className="authgate-success-copy">
            If an account exists for <strong>{email.trim()}</strong>, you will receive a reset link
            shortly. It expires in 30 minutes.
          </p>
          <p className="authgate-success-note">
            Check your spam folder if it does not arrive within a few minutes.
          </p>
          <button
            type="button"
            className="authgate-secondary"
            onClick={() => {
              setSent(false);
              setError("");
            }}
          >
            Use a different email
          </button>
          <p className="authgate-success-help">
            Still stuck? <Link href="/contact">Contact support</Link>.
          </p>
        </div>
      ) : (
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

          {error && (
            <p className="authgate-error" role="alert">
              {error}
            </p>
          )}

          <button className="authgate-submit" disabled={busy}>
            <span>{busy ? "Sending link..." : "Send reset link"}</span>
            {busy ? <MailCheck size={17} /> : <ArrowRight size={17} />}
          </button>
        </form>
      )}
    </AuthGate>
  );
}
