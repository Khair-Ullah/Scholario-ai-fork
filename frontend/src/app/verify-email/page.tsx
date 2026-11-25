"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link2Off } from "lucide-react";
import AuthGate, { AuthLink, AuthSwitchLink } from "@/components/AuthGate";
import OtpForm from "@/components/OtpForm";

function VerifyEmailContent() {
  const email = (useSearchParams().get("email") ?? "").trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <AuthGate
      mobileAlign="center"
      kicker="EMAIL VERIFICATION"
      headline={
        <>
          One final <em>step.</em>
        </>
      }
      copy="Verify your email address to activate your Scholario account."
      points={[
        "6-digit code from your email",
        "Code expires in 10 minutes",
        "Sign in after verification",
      ]}
      eyebrow="VERIFY EMAIL"
      title={emailLooksValid ? "Enter your verification code" : "We need your email"}
      subtitle={
        emailLooksValid
          ? `We sent a code to ${email}. It expires in 10 minutes.`
          : "Open the verification link again or register to get a fresh code."
      }
      switchLine={
        <AuthSwitchLink href="/login" direction="left" label="Already verified?" cta="Sign in" />
      }
    >
      {emailLooksValid ? (
        <OtpForm email={email} />
      ) : (
        <div className="authgate-success authgate-success-warn">
          <span className="authgate-success-icon">
            <Link2Off size={22} />
          </span>
          <p className="authgate-success-copy">The verification link is missing the email address.</p>
          <p className="authgate-success-note">Codes expire in 10 minutes, so register again if needed.</p>
          <AuthLink className="authgate-secondary" href="/register" direction="left">
            Back to registration
          </AuthLink>
        </div>
      )}
    </AuthGate>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="authgate-viewport">
          <p className="authgate-loading">Preparing verification...</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
