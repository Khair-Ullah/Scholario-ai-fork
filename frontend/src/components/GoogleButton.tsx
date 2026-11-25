"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, resetSessionCache } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function GoogleButton({ mode = "signin" }: { mode?: "signin" | "signup" | "link" }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!CLIENT_ID || !container.current) return;
    let cancelled = false;

    async function handle(response: { credential?: string }) {
      if (!response.credential) return;
      setError("");
      setMessage("");
      try {
        await apiFetch(mode === "link" ? "/api/auth/google/link" : "/api/auth/google", {
          method: "POST",
          body: JSON.stringify({ credential: response.credential }),
        });
        if (mode === "link") {
          setMessage("Google account linked successfully.");
          return;
        }
        resetSessionCache();
        const next = new URLSearchParams(window.location.search).get("next");
        const safeNext =
          next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
            ? next
            : "/dashboard";
        router.replace(safeNext);
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "GOOGLE_LINK_REQUIRED") {
          setError(
            "An account already exists. Sign in with your password first, then link Google from your profile.",
          );
          return;
        }
        setError(cause instanceof Error ? cause.message : "Google sign-in failed. Please try again.");
      }
    }

    function render() {
      if (cancelled || !window.google || !container.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handle });
      window.google.accounts.id.renderButton(container.current, {
        theme: "outline",
        size: "large",
        width: 336,
        shape: "rectangular",
        logo_alignment: "left",
        text: mode === "signup" ? "signup_with" : "continue_with",
      });
    }

    if (window.google) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setError("Google sign-in could not load. You can still use email.");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [router, mode]);

  if (!CLIENT_ID) return null;

  return (
    <div className="google-auth">
      <div className="google-auth-divider"><span>or</span></div>
      <div ref={container} className="google-auth-button" />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="input-hint" role="status">{message}</p>}
    </div>
  );
}
