"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type ConsultantWarning } from "@/admin/api";

const PAGE_SIZE = 50;

const severityClass: Record<string, string> = {
  info: "admin-pill",
  warning: "admin-pill amber",
  critical: "admin-pill red",
};

export default function AdminWarningsPage() {
  const [warnings, setWarnings] = useState<ConsultantWarning[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [severity, setSeverity] = useState("");
  const [open, setOpen] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function load(nextPage = page, nextSeverity = severity, nextOpen = open) {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listWarnings({
        page: nextPage,
        page_size: PAGE_SIZE,
        severity: nextSeverity || undefined,
        is_acknowledged: nextOpen === "" ? undefined : nextOpen === "open" ? false : true,
      });
      setWarnings(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load warnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    adminApi
      .listWarnings({ page: 1, page_size: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setWarnings(result.items);
        setTotal(result.total ?? 0);
        setPage(result.page);
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

  const columns: Column<ConsultantWarning>[] = [
    {
      key: "consultant",
      label: "Consultant",
      render: (w) => (
        <>
          <strong>{w.consultant_email ?? `#${w.consultant_id}`}</strong>
          <small>{w.issued_by_email ? `by ${w.issued_by_email}` : "auto-detected"}</small>
        </>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (w) => <span className={severityClass[w.severity] ?? "admin-pill"}>{w.severity}</span>,
    },
    { key: "reason", label: "Reason", render: (w) => w.reason },
    {
      key: "state",
      label: "State",
      render: (w) => (
        <span className={w.is_acknowledged ? "admin-pill green" : "admin-pill amber"}>
          {w.is_acknowledged ? "Acknowledged" : "Open"}
        </span>
      ),
    },
    {
      key: "created",
      label: "Created",
      render: (w) => (w.created_at ? new Date(w.created_at).toLocaleString() : "—"),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="TRUST & SAFETY"
        title="Consultant warnings"
        description="Automatic anomaly detection and manual platform warnings issued to consultants."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <div className="admin-filter-bar">
        <label>
          Severity
          <select
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              void load(1, event.target.value, open);
            }}
          >
            <option value="">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          State
          <select
            value={open}
            onChange={(event) => {
              setOpen(event.target.value);
              void load(1, severity, event.target.value);
            }}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="ack">Acknowledged</option>
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={warnings}
        loading={loading}
        emptyText="No warnings recorded."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} warnings · page {page} of {pages}
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
    </div>
  );
}
