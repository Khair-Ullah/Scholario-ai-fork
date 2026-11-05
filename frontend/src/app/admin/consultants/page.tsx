"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type AdminConsultant } from "@/admin/api";

const PAGE_SIZE = 50;

export default function AdminConsultantsPage() {
  const [consultants, setConsultants] = useState<AdminConsultant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);
  const [warnTarget, setWarnTarget] = useState<AdminConsultant | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [warning, setWarning] = useState<{
    severity: "info" | "warning" | "critical";
    reason: string;
    detail: string;
  }>({ severity: "warning", reason: "", detail: "" });

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listConsultants({ page: nextPage, page_size: PAGE_SIZE });
      setConsultants(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load consultants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    adminApi
      .listConsultants({ page: 1, page_size: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setConsultants(result.items);
        setTotal(result.total ?? 0);
        setPage(result.page);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load consultants.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitCreate() {
    setBusy(true);
    setError("");
    try {
      await adminApi.createConsultant(form);
      setCreating(false);
      setForm({ email: "", full_name: "", password: "" });
      setToast("Consultant account created.");
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create consultant.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(consultant: AdminConsultant) {
    setError("");
    try {
      const saved = await adminApi.updateConsultant(consultant.id, { is_active: !consultant.is_active });
      setConsultants((current) => current.map((item) => (item.id === consultant.id ? saved : item)));
      setToast(`${saved.email} ${saved.is_active ? "enabled" : "suspended"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update consultant.");
    }
  }

  async function submitWarning() {
    if (!warnTarget) return;
    setBusy(true);
    setError("");
    try {
      await adminApi.warnConsultant(warnTarget.id, warning);
      setToast(`Warning sent to ${warnTarget.email}.`);
      setWarnTarget(null);
      setWarning({ severity: "warning", reason: "", detail: "" });
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send warning.");
    } finally {
      setBusy(false);
    }
  }

  async function reset2fa(consultant: AdminConsultant) {
    setError("");
    try {
      await adminApi.resetConsultant2fa(consultant.id);
      setToast(`Two-factor authentication reset for ${consultant.email}.`);
      await load(page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset 2FA.");
    }
  }

  const columns: Column<AdminConsultant>[] = [
    {
      key: "consultant",
      label: "Consultant",
      render: (consultant) => (
        <span className="admin-account-cell">
          <span>
            <strong>{consultant.full_name || "Unnamed"}</strong>
            <small>{consultant.email}</small>
          </span>
        </span>
      ),
    },
    { key: "scholarships", label: "Scholarships", render: (c) => c.scholarships },
    {
      key: "warnings",
      label: "Open warnings",
      render: (c) => (
        <span className={c.open_warnings > 0 ? "admin-pill red" : "admin-pill green"}>{c.open_warnings}</span>
      ),
    },
    {
      key: "2fa",
      label: "2FA",
      render: (c) => (
        <span className={c.totp_enabled ? "admin-chip-active" : "admin-chip-inactive"}>
          <ShieldCheck size={13} /> {c.totp_enabled ? "On" : "Off"}
        </span>
      ),
    },
    {
      key: "access",
      label: "Access",
      render: (c) => (
        <button
          className={c.is_active ? "admin-chip-active" : "admin-chip-inactive"}
          onClick={() => void toggleActive(c)}
        >
          {c.is_active ? "Active" : "Suspended"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (c) => (
        <span className="admin-row-actions">
          <button className="admin-outline" onClick={() => setWarnTarget(c)}>
            <Send size={13} /> Warn
          </button>
          <button className="admin-outline" onClick={() => void reset2fa(c)}>
            <RefreshCcw size={13} /> Reset 2FA
          </button>
        </span>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="PARTNERS"
        title="Consultants"
        description={`${total.toLocaleString()} consultant accounts manage their own scholarships.`}
        actions={
          <button className="admin-btn primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New consultant
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <DataTable
        columns={columns}
        rows={consultants}
        loading={loading}
        emptyText="No consultants yet."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} consultants · page {page} of {pages}
            </span>
            <span>
              <button disabled={page <= 1} onClick={() => void load(page - 1)}>
                Previous
              </button>
              <button disabled={page >= pages} onClick={() => void load(page + 1)}>
                Next
              </button>
            </span>
          </div>
        }
      />

      <Drawer open={creating} title="New consultant" onClose={() => setCreating(false)} width={460}>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <label>
            Full name
            <input
              required
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Temporary password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <button className="admin-btn primary" disabled={busy}>
            {busy ? "Creating..." : "Create consultant"}
          </button>
        </form>
      </Drawer>

      <Drawer
        open={warnTarget !== null}
        title={warnTarget ? `Warn ${warnTarget.email}` : "Send warning"}
        onClose={() => setWarnTarget(null)}
        width={460}
      >
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitWarning();
          }}
        >
          <label>
            Severity
            <select
              value={warning.severity}
              onChange={(event) =>
                setWarning({ ...warning, severity: event.target.value as "info" | "warning" | "critical" })
              }
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Reason
            <input
              required
              maxLength={200}
              value={warning.reason}
              onChange={(event) => setWarning({ ...warning, reason: event.target.value })}
            />
          </label>
          <label>
            Detail
            <textarea
              rows={4}
              value={warning.detail}
              onChange={(event) => setWarning({ ...warning, detail: event.target.value })}
            />
          </label>
          <button className="admin-btn primary" disabled={busy}>
            {busy ? "Sending..." : "Send warning"}
          </button>
        </form>
      </Drawer>
    </div>
  );
}
