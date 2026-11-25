"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { OTP_MODE, OtpServiceError, resendEmailOtp, verifyEmailOtp } from "@/lib/auth-otp";

type Phase = "ready" | "verifying" | "success";

const RESEND_SECONDS = 60;

function messageFor(error: OtpServiceError): string {
  switch (error.code) {
    case "INVALID_OTP":
      return "That code does not look right. Check it and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Request a new one to continue.";
    case "OTP_LIMIT":
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment before trying again.";
    case "INTEGRATION_PENDING":
      return "Email verification is not available yet. Please contact support.";
    case "INVALID_EMAIL":
      return "That email address does not look right. Please check it and try again.";
    default:
      return "The service is temporarily unavailable. Please try again.";
  }
}

export default function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = window.setTimeout(() => router.replace("/login?verified=1"), 1200);
    return () => window.clearTimeout(timer);
  }, [phase, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setPhase("verifying");
    setError("");
    setMessage("");
    try {
      await verifyEmailOtp(email, otp);
      setPhase("success");
    } catch (cause) {
      const otpError =
        cause instanceof OtpServiceError
          ? cause
          : new OtpServiceError("We could not verify that code.", "NETWORK");
      setError(messageFor(otpError));
      setOtp("");
      if (otpError.code === "OTP_EXPIRED") setCooldown(0);
      if (otpError.code === "OTP_LIMIT" || otpError.code === "RATE_LIMITED") setCooldown(RESEND_SECONDS);
      setPhase("ready");
    }
  }

  async function resend() {
    if (resending || cooldown > 0 || phase !== "ready") return;
    setResending(true);
    setError("");
    setMessage("");
    try {
      await resendEmailOtp(email);
      setOtp("");
      setCooldown(RESEND_SECONDS);
      setMessage("A new verification code has been sent.");
    } catch (cause) {
      const otpError =
        cause instanceof OtpServiceError
          ? cause
          : new OtpServiceError("We could not resend the verification code.", "NETWORK");
      setError(messageFor(otpError));
      if (otpError.code === "OTP_LIMIT" || otpError.code === "RATE_LIMITED") setCooldown(RESEND_SECONDS);
    } finally {
      setResending(false);
    }
  }

  if (phase === "success") {
    return (
      <div className="authgate-success" role="status">
        <span className="authgate-success-icon">
          <CheckCircle2 size={22} />
        </span>
        <p className="authgate-success-copy">Your email is verified. You can sign in now.</p>
        <p className="authgate-success-note">Redirecting you to sign in...</p>
      </div>
    );
  }

  const busy = phase === "verifying" || resending;

  return (
    <>
      <form onSubmit={submit} className="authgate-form">
        <label className="authgate-field">
          <span>Six-digit verification code</span>
          <span className="authgate-password">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              disabled={busy}
              aria-label="6-digit verification code"
              style={{ letterSpacing: "0.38em", textAlign: "center", fontSize: "1.25rem" }}
            />
          </span>
          <span className="input-hint">
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </span>
        </label>

        {error && (
          <p className="authgate-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        {message && (
          <p className="authgate-success-note" role="status">
            {message}
          </p>
        )}

        <button className="authgate-submit" disabled={busy}>
          <span>{phase === "verifying" ? "Verifying..." : "Verify email"}</span>
          {phase === "verifying" ? <RefreshCw size={17} /> : <ArrowRight size={17} />}
        </button>
      </form>

      <button
        type="button"
        className="authgate-secondary"
        style={{ marginTop: "12px" }}
        onClick={resend}
        disabled={busy || cooldown > 0}
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
      </button>

      {OTP_MODE === "mock" && (
        <p className="authgate-success-note" style={{ marginTop: "10px" }}>
          Development OTP mock is active. Any 6-digit code works; add ?simulate=invalid,
          ?simulate=expired, or ?simulate=rate-limited to test states.
        </p>
      )}
    </>
  );
}
