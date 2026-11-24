"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link2Off } from "lucide-react";
import AuthGate, { AuthLink, AuthSwitchLink } from "@/components/AuthGate";
import OtpForm from "@/components/OtpForm";
import type { OtpPurpose } from "@/lib/auth-otp";

function VerifyOtpContent() {
  const params = useSearchParams();
  const email = (params.get("email") ?? "").trim();
  const purpose: OtpPurpose =
    params.get("purpose") === "password-reset" ? "password-reset" : "registration";
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const backHref = purpose === "password-reset" ? "/forgot-password" : "/register";
  const backLabel = purpose === "password-reset" ? "Request a new code" : "Use a different email";

  let eyebrow = "VERIFY EMAIL";
  let title = "Check your inbox";
  let subtitle = `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.`;

  if (!emailLooksValid) {
    eyebrow = "LINK PROBLEM";
    title = "We need your email";
    subtitle = "Open the verification link again or request a fresh code.";
  } else if (purpose === "password-reset") {
    eyebrow = "VERIFY RESET";
    title = "Confirm it's you";
    subtitle = `Enter the 6-digit reset code sent to ${email}. It expires in 10 minutes.`;
  }

  return (
    <AuthGate
      mobileAlign="center"
      kicker="SECURE BY DEFAULT"
      headline={
        <>
          One step closer.
          <br />
          Let&apos;s keep it <em>secure.</em>
        </>
      }
      copy="Verify the code sent to your email before continuing to your account."
      points={
        purpose === "registration"
          ? ["6-digit code from your email", "Code expires in 10 minutes", "Sign in after verification"]
          : ["6-digit code from your email", "One-time reset token", "Choose a new password next"]
      }
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      switchLine={
        <AuthSwitchLink href="/login" direction="left" label="Already verified?" cta="Sign in" />
      }
    >
      {emailLooksValid ? (
        <OtpForm purpose={purpose} email={email} />
      ) : (
        <div className="authgate-success authgate-success-warn">
          <span className="authgate-success-icon">
            <Link2Off size={22} />
          </span>
          <p className="authgate-success-copy">
            The verification link is missing the email address.
          </p>
          <p className="authgate-success-note">
            Codes expire in 10 minutes, so request a new one if needed.
          </p>
          <AuthLink className="authgate-secondary" href={backHref} direction="left">
            {backLabel}
          </AuthLink>
        </div>
      )}
    </AuthGate>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="authgate-viewport">
          <p className="authgate-loading">Preparing verification...</p>
        </main>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
