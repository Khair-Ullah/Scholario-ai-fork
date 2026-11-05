"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { consultantApi, type ConsultantWarning } from "@/consultant/api";

const severityClass: Record<string, string> = {
  info: "admin-pill",
  warning: "admin-pill amber",
  critical: "admin-pill red",
};

export default function ConsultantWarningsPage() {
  const [warnings, setWarnings] = useState<ConsultantWarning[]>([]);
  const [includeAck, setIncludeAck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(include = includeAck) {
    setLoading(true);
    setError("");
    try {
      setWarnings(await consultantApi.listWarnings(include));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load warnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    consultantApi
      .listWarnings(false)
      .then((result) => {
        if (active) setWarnings(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load warnings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function acknowledge(id: number) {
    setBusyId(id);
    try {
      await consultantApi.acknowledgeWarning(id);
      setToast("Warning acknowledged.");
      await load(includeAck);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not acknowledge warning.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="TRUST & SAFETY"
        title="Warnings"
        description="Warnings raised by the platform about activity on your account."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <div className="admin-filter-bar">
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={includeAck}
            onChange={(event) => {
              setIncludeAck(event.target.checked);
              void load(event.target.checked);
            }}
          />
          Show acknowledged
        </label>
      </div>
      {loading ? (
        <p className="admin-thumb">Loading…</p>
      ) : warnings.length === 0 ? (
        <div className="admin-empty">
          <CheckCircle2 size={18} /> No {includeAck ? "" : "open "}warnings. You are all clear.
        </div>
      ) : (
        <ul className="admin-warning-list">
          {warnings.map((warning) => (
            <li key={warning.id} className="admin-warning-card">
              <div className="admin-warning-head">
                <span className={severityClass[warning.severity] ?? "admin-pill"}>
                  <AlertTriangle size={12} /> {warning.severity}
                </span>
                <strong>{warning.reason}</strong>
                {warning.created_at && <small>{new Date(warning.created_at).toLocaleString()}</small>}
              </div>
              {warning.detail && <p>{warning.detail}</p>}
              <div className="admin-row-actions">
                {warning.is_acknowledged ? (
                  <span className="admin-pill green">Acknowledged</span>
                ) : (
                  <button
                    className="admin-outline"
                    disabled={busyId === warning.id}
                    onClick={() => void acknowledge(warning.id)}
                  >
                    <CheckCircle2 size={14} /> {busyId === warning.id ? "Saving..." : "Acknowledge"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
