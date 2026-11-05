"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

type MfaStatus = { enabled: boolean; has_pending_secret: boolean; recovery_codes_remaining: number };
type AuthResponse = { user: { role: string }; message: string; recovery_codes?: string[] | null };

export function MfaPanel() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const result = await apiFetch<MfaStatus>("/api/auth/mfa/status");
      setStatus(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load 2FA status.");
    }
  }

  useEffect(() => {
    let active = true;
    apiFetch<MfaStatus>("/api/auth/mfa/status")
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load 2FA status.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function startSetup() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ secret: string; otpauth_uri: string }>("/api/auth/mfa/setup", {
        method: "POST",
      });
      setSecret(result.secret);
      setUri(result.otpauth_uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<AuthResponse>("/api/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecovery(result.recovery_codes ?? []);
      setSecret("");
      setUri("");
      setCode("");
      setMessage("Two-factor authentication enabled.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      await apiFetch<AuthResponse>("/api/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
      setCode("");
      setRecovery([]);
      setMessage("Two-factor authentication disabled.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<AuthResponse>("/api/auth/mfa/recovery-codes", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecovery(result.recovery_codes ?? []);
      setCode("");
      setMessage("New recovery codes generated.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not regenerate codes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-box">
      <h3>
        <ShieldCheck size={16} /> Two-factor authentication
      </h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="admin-note">{message}</p>}
      {!status ? (
        <p className="admin-thumb">Loading…</p>
      ) : status.enabled ? (
        <>
          <p className="admin-thumb">
            <ShieldCheck size={14} /> Enabled · {status.recovery_codes_remaining} recovery codes remaining.
          </p>
          {!secret && (
            <div className="admin-form">
              <label>
                Enter a current code to manage 2FA
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                />
              </label>
              <div className="admin-row-actions">
                <button className="admin-outline" disabled={busy || code.length < 6} onClick={() => void regenerate()}>
                  <KeyRound size={14} /> Regenerate recovery codes
                </button>
                <button className="admin-btn danger" disabled={busy || code.length < 6} onClick={() => void disable()}>
                  <ShieldOff size={14} /> Disable 2FA
                </button>
              </div>
            </div>
          )}
        </>
      ) : secret ? (
        <div className="admin-form">
          <p className="admin-thumb">Add this secret to your authenticator app, then confirm.</p>
          <code className="admin-code">{secret}</code>
          <p className="admin-thumb admin-break">{uri}</p>
          <label>
            Confirmation code
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
            />
          </label>
          <button className="admin-btn primary" disabled={busy || code.length < 6} onClick={() => void confirmEnable()}>
            {busy ? "Verifying..." : "Enable 2FA"}
          </button>
        </div>
      ) : (
        <button className="admin-btn primary" disabled={busy} onClick={() => void startSetup()}>
          <ShieldCheck size={14} /> {busy ? "Starting..." : "Enable 2FA"}
        </button>
      )}

      {recovery.length > 0 && (
        <div className="admin-box">
          <h3>Recovery codes</h3>
          <p className="admin-thumb">Store these somewhere safe. They are shown only once.</p>
          <ul className="admin-recovery-codes">
            {recovery.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
