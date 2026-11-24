"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { OTP_MODE, OtpServiceError, requestOtp, resendOtp, verifyOtp } from "@/lib/auth-otp";
import type { OtpPurpose, OtpVerificationResult } from "@/lib/auth-otp";

type Phase = "sending" | "ready" | "verifying" | "success";

const RESEND_SECONDS = 45;

function messageFor(error: OtpServiceError): string {
  switch (error.code) {
    case "INVALID_OTP":
      return "That code does not look right. Check it and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Request a new one to continue.";
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

export default function OtpForm({ purpose, email }: { purpose: OtpPurpose; email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("sending");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [result, setResult] = useState<OtpVerificationResult | null>(null);
  const requestedRef = useRef(false);

  const sendInitial = useCallback(async () => {
    setPhase("sending");
    setError("");
    try {
      await requestOtp(purpose, email);
      setCooldown(RESEND_SECONDS);
      setPhase("ready");
    } catch (cause) {
      setError(
        cause instanceof OtpServiceError
          ? messageFor(cause)
          : "We could not send the verification code.",
      );
      setPhase("ready");
    }
  }, [email, purpose]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void sendInitial();
  }, [sendInitial]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (phase !== "success" || !result) return;
    const target =
      purpose === "registration"
        ? "/login"
        : `/reset-password?token=${encodeURIComponent(result.status === "reset_token" ? result.resetToken : "")}`;
    const timer = window.setTimeout(() => router.replace(target), 1200);
    return () => window.clearTimeout(timer);
  }, [phase, purpose, result, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setPhase("verifying");
    setError("");
    try {
      const verified = await verifyOtp(purpose, email, code);
      setResult(verified);
      setPhase("success");
    } catch (cause) {
      const otpError =
        cause instanceof OtpServiceError
          ? cause
          : new OtpServiceError("We could not verify that code.", "NETWORK");
      setError(messageFor(otpError));
      setCode("");
      if (otpError.code === "OTP_EXPIRED") setCooldown(0);
      if (otpError.code === "RATE_LIMITED") setCooldown(RESEND_SECONDS);
      setPhase("ready");
    }
  }

  async function resend() {
    if (cooldown > 0 || phase === "sending" || phase === "verifying") return;
    setPhase("sending");
    setError("");
    try {
      await resendOtp(purpose, email);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setPhase("ready");
    } catch (cause) {
      const otpError =
        cause instanceof OtpServiceError
          ? cause
          : new OtpServiceError("We could not resend the verification code.", "NETWORK");
      setError(messageFor(otpError));
      if (otpError.code === "RATE_LIMITED") setCooldown(RESEND_SECONDS);
      setPhase("ready");
    }
  }

  if (phase === "success") {
    return (
      <div className="authgate-success" role="status">
        <span className="authgate-success-icon">
          <CheckCircle2 size={22} />
        </span>
        <p className="authgate-success-copy">
          {purpose === "registration"
            ? "Your email is verified. You can sign in now."
            : "Code verified. Choose a new password next."}
        </p>
        <p className="authgate-success-note">
          {purpose === "registration"
            ? "Redirecting you to sign in..."
            : "Redirecting you to password reset..."}
        </p>
      </div>
    );
  }

  const busy = phase === "sending" || phase === "verifying";

  return (
    <>
      <form onSubmit={submit} className="authgate-form">
        <label className="authgate-field">
          <span>Verification code</span>
          <span className="authgate-password">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
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

        <button className="authgate-submit" disabled={busy}>
          <span>
            {phase === "verifying"
              ? "Verifying..."
              : phase === "sending"
                ? "Sending code..."
                : "Verify code"}
          </span>
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
        {cooldown > 0
          ? `Resend in ${cooldown}s`
          : phase === "sending"
            ? "Sending..."
            : "Resend code"}
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
