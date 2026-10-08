"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { adminApi, type PaymentsSummary } from "@/admin/api";

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsSummary | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [grant, setGrant] = useState({ user_id: "", plan: "pro", expires_at: "" });
  const [transfer, setTransfer] = useState({ reference: "", user_id: "", note: "" });

  async function load() {
    setError("");
    try {
      setData(await adminApi.payments());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load payment overview.");
    }
  }

  useEffect(() => {
    let active = true;
    adminApi
      .payments()
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load payment overview.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function grantPlan() {
    setBusy("grant");
    setError("");
    try {
      await adminApi.grantPlan({
        user_id: Number(grant.user_id),
        plan: grant.plan as "free" | "pro",
        expires_at: grant.expires_at || null,
      });
      setToast(`Granted ${grant.plan} to user ${grant.user_id}.`);
      setGrant({ user_id: "", plan: "pro", expires_at: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not grant plan.");
    } finally {
      setBusy("");
    }
  }

  async function decide(reference: string, approve: boolean) {
    setBusy(reference);
    setError("");
    try {
      await adminApi.approveTransfer({
        reference,
        approve,
        user_id: transfer.user_id ? Number(transfer.user_id) : undefined,
      });
      setToast(approve ? `Approved transfer ${reference}.` : `Rejected transfer ${reference}.`);
      setTransfer({ reference: "", user_id: "", note: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process transfer.");
    } finally {
      setBusy("");
    }
  }

  const history = data?.history ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="REVENUE & ACCESS"
        title="Payments"
        description="Grant pro plans and review transfer requests."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />

      <div className="admin-stat-grid">
        <div className="admin-stat">
          <span>
            <Sparkles size={17} />
          </span>
          <small>Free accounts</small>
          <strong>{data?.plan_counts?.free?.toLocaleString() ?? "—"}</strong>
        </div>
        <div className="admin-stat">
          <span>
            <Sparkles size={17} />
          </span>
          <small>Pro accounts</small>
          <strong>{data?.plan_counts?.pro?.toLocaleString() ?? "—"}</strong>
        </div>
        <div className="admin-stat">
          <span>
            <Sparkles size={17} />
          </span>
          <small>Disabled accounts</small>
          <strong>{data?.disabled?.toLocaleString() ?? "—"}</strong>
        </div>
      </div>

      <section className="admin-box">
        <h3>Grant a plan manually</h3>
        <div className="admin-announce-form admin-announce-row">
          <input type="number" placeholder="User ID" value={grant.user_id} onChange={(e) => setGrant({ ...grant, user_id: e.target.value })} />
          <select value={grant.plan} onChange={(e) => setGrant({ ...grant, plan: e.target.value })}>
            <option value="pro">Pro</option>
            <option value="free">Free</option>
          </select>
          <input type="date" value={grant.expires_at} onChange={(e) => setGrant({ ...grant, expires_at: e.target.value })} />
          <button className="admin-btn primary" disabled={busy === "grant" || !grant.user_id} onClick={() => void grantPlan()}>
            {busy === "grant" ? "Granting..." : "Grant plan"}
          </button>
        </div>
      </section>

      <section className="admin-box">
        <h3>Transfer request</h3>
        <p>{data?.note}</p>
        <div className="admin-announce-form admin-announce-row">
          <input placeholder="Reference" value={transfer.reference} onChange={(e) => setTransfer({ ...transfer, reference: e.target.value })} />
          <input type="number" placeholder="User ID (optional)" value={transfer.user_id} onChange={(e) => setTransfer({ ...transfer, user_id: e.target.value })} />
          <input placeholder="Note" value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} />
          <button className="admin-btn primary" disabled={busy !== "" || !transfer.reference} onClick={() => void decide(transfer.reference, true)}>
            Approve
          </button>
          <button className="admin-btn danger" disabled={busy !== "" || !transfer.reference} onClick={() => void decide(transfer.reference, false)}>
            Reject
          </button>
        </div>
      </section>

      <section className="admin-box">
        <h3>Recent payment activity</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>By</th>
                <th>When</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.action}</strong>
                  </td>
                  <td>{entry.actor_email ?? "system"}</td>
                  <td>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}</td>
                  <td>
                    <span className="admin-thumb">{entry.diff ? JSON.stringify(entry.diff).slice(0, 60) : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <div className="admin-empty">No payment actions recorded yet.</div>}
        </div>
      </section>
    </div>
  );
}