"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type AuditEntry } from "@/admin/api";

const ACTIONS = [
  "all",
  "auth.admin_login",
  "auth.admin_login_failed",
  "user.update",
  "user.revoke_sessions",
  "user.reset_onboarding",
  "scholarship.create",
  "scholarship.update",
  "scholarship.delete",
  "scholarship.import",
  "university.country_update",
  "template.create",
  "template.update",
  "template.delete",
  "template.reorder",
  "announcement.send",
  "payment.grant",
  "payment.transfer_approved",
  "payment.transfer_rejected",
  "settings.update",
];

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actor, setActor] = useState("");
  const [draftActor, setDraftActor] = useState("");

  async function load(nextPage = page, nextAction = actionFilter, nextActor = actor) {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listAudit({
        page: nextPage,
        page_size: 50,
        action: nextAction === "all" ? undefined : nextAction,
        actor: nextActor || undefined,
      });
      setItems(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load audit log.");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
    let active = true;
    adminApi
      .listAudit({ page: 1, page_size: 50 })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.total ?? 0);
          setPage(result.page);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load audit log.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo<Column<AuditEntry>[]>(
    () => [
      {
        key: "when",
        label: "When",
        render: (entry) => (
          <>
            <strong>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}</strong>
            <small>{entry.ip ?? "no ip"}</small>
          </>
        ),
      },
      {
        key: "action",
        label: "Action",
        render: (entry) => <span className="admin-pill">{entry.action}</span>,
      },
      {
        key: "entity",
        label: "Entity",
        render: (entry) => (
          <>
            <strong>{entry.entity}</strong>
            <small>{entry.entity_id?.toString() ?? ""}</small>
          </>
        ),
      },
      {
        key: "actor",
        label: "Actor",
        render: (entry) => entry.actor_email ?? "system",
      },
      {
        key: "diff",
        label: "Changes",
        render: (entry) => (
          <span className="admin-thumb">{entry.diff ? JSON.stringify(entry.diff).slice(0, 90) : "—"}</span>
        ),
      },
    ],
    [],
  );

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="SECURITY"
        title="Audit log"
        description="Immutable record of administrative and platform actions."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-filter-bar">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setActor(draftActor);
            void load(1, actionFilter, draftActor);
          }}
        >
          <Search size={16} />
          <input value={draftActor} onChange={(e) => setDraftActor(e.target.value)} placeholder="Filter by actor email" />
          <button className="admin-outline">Filter</button>
        </form>
        <label>
          Action
          <select
            value={actionFilter}
            onChange={(event) => {
              setActionFilter(event.target.value);
              void load(1, event.target.value, actor);
            }}
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action === "all" ? "All actions" : action}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyText="No audit entries match."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} entries · page {page} of {pages}
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