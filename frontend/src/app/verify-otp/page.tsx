"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyOtpRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const purpose = params.get("purpose");

  useEffect(() => {
    const target =
      purpose === "password-reset"
        ? `/forgot-password?email=${encodeURIComponent(email)}`
        : `/verify-email?email=${encodeURIComponent(email)}`;
    router.replace(target);
  }, [email, purpose, router]);

  return (
    <main className="authgate-viewport">
      <p className="authgate-loading">Redirecting to email verification...</p>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="authgate-viewport">
          <p className="authgate-loading">Redirecting to email verification...</p>
        </main>
      }
    >
      <VerifyOtpRedirect />
    </Suspense>
  );
}
