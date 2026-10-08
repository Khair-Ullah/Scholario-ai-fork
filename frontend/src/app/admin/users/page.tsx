"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Search, ShieldCheck, Trash } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type AdminUser } from "@/admin/api";

const PAGE_SIZE = 50;

function Initials({ name }: { name: string }) {
  return (
    <span className="admin-avatar">
      {name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("") || "?"}
    </span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState({ total: 0, pro: 0, disabled: 0, admins: 0 });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<"revoke" | "reset" | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function load(nextPage = page, term = query, currentPlan = plan) {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listUsers({
        q: term,
        page: nextPage,
        page_size: PAGE_SIZE,
        plan: currentPlan,
      });
      setUsers(result.items);
      setTotal(result.total ?? 0);
      setCounts(result.counts ?? { total: 0, pro: 0, disabled: 0, admins: 0 });
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
    let active = true;
    adminApi
      .listUsers({ q: "", page: 1, page_size: PAGE_SIZE, plan: "" })
      .then((result) => {
        if (active) {
          setUsers(result.items);
          setTotal(result.total ?? 0);
          setCounts(result.counts ?? { total: 0, pro: 0, disabled: 0, admins: 0 });
          setPage(result.page);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load users.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function update(user: AdminUser, patch: Partial<AdminUser>) {
    setError("");
    try {
      const saved = await adminApi.updateUser(user.id, patch);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...saved } : item)));
      if (detail?.id === user.id) setDetail({ ...detail, ...saved });
      setToast(`Updated ${user.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update account.");
    }
  }

  async function openDetail(user: AdminUser) {
    setError("");
    try {
      const full = await adminApi.getUser(user.id);
      setDetail(full);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load account details.");
    }
  }

  async function runAction() {
    if (!detail) return;
    setBusy(confirmAction ?? "");
    setError("");
    try {
      if (confirmAction === "revoke") {
        const result = await adminApi.revokeSessions(detail.id);
        setToast(`Revoked ${result.revoked} session(s).`);
      } else if (confirmAction === "reset") {
        const result = await adminApi.resetOnboarding(detail.id);
        setToast(`Onboarding reset to step ${result.onboarding_step}.`);
      }
      const fresh = await adminApi.getUser(detail.id);
      setDetail(fresh);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy("");
      setConfirmAction(null);
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "account",
      label: "Account",
      render: (user) => (
        <span className="admin-account-cell">
          <Initials name={user.full_name} />
          <span>
            <button className="admin-link" onClick={() => void openDetail(user)}>
              {user.full_name || "Unnamed"}
            </button>
            <small>{user.email}</small>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (user) => <span className="admin-role-chip">{user.role}</span>,
    },
    {
      key: "plan",
      label: "Plan",
      render: (user) => (
        <select
          value={user.plan}
          onChange={(event) => update(user, { plan: event.target.value })}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      ),
    },
    {
      key: "access",
      label: "Access",
      render: (user) => (
        <button
          className={user.is_active ? "admin-chip-active" : "admin-chip-inactive"}
          onClick={() => update(user, { is_active: !user.is_active })}
        >
          <ShieldCheck size={13} /> {user.is_active ? "Active" : "Disabled"}
        </button>
      ),
    },
    {
      key: "joined",
      label: "Joined",
      render: (user) => (
        <>
          <strong>{new Date(user.created_at).toLocaleDateString()}</strong>
          <small>{user.last_login_at ? `seen ${new Date(user.last_login_at).toLocaleDateString()}` : "never logged in"}</small>
        </>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="ACCOUNT MANAGEMENT"
        title="Users"
        description={`${counts.total.toLocaleString()} accounts · ${counts.pro.toLocaleString()} pro · ${counts.disabled.toLocaleString()} disabled · ${counts.admins.toLocaleString()} admins`}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <div className="admin-filter-bar">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draft);
            void load(1, draft, plan);
          }}
        >
          <Search size={16} />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search name or email" />
          <button className="admin-outline">Search</button>
        </form>
        <label>
          Plan
          <select
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value);
              void load(1, query, event.target.value);
            }}
          >
            <option value="">All</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        emptyText="No accounts match this query."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} accounts · page {page} of {pages}
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

      <Drawer
        open={detail !== null}
        title={detail ? detail.email : ""}
        onClose={() => setDetail(null)}
        width={500}
      >
        {detail && (
          <div className="admin-drawer-grid">
            <div className="admin-key-value">
              <span>Name</span>
              <strong>{detail.full_name || "—"}</strong>
              <span>Joined</span>
              <strong>{new Date(detail.created_at).toLocaleString()}</strong>
              <span>Plan</span>
              <strong>{detail.plan}</strong>
              {detail.plan_expires_at && (
                <>
                  <span>Plan expires</span>
                  <strong>{new Date(detail.plan_expires_at).toLocaleDateString()}</strong>
                </>
              )}
              <span>Last login</span>
              <strong>{detail.last_login_at ? new Date(detail.last_login_at).toLocaleString() : "never"}</strong>
              <span>Verified</span>
              <strong>{detail.is_verified ? "Yes" : "No"}</strong>
            </div>

            <section className="admin-box">
              <h3>Activity</h3>
              <div className="admin-key-value">
                <span>Saved</span>
                <strong>{detail.stats?.saved ?? 0}</strong>
                <span>Applications</span>
                <strong>{detail.stats?.applications ?? 0}</strong>
                <span>Documents</span>
                <strong>{detail.stats?.documents ?? 0}</strong>
                <span>Notifications</span>
                <strong>{detail.stats?.notifications ?? 0}</strong>
                <span>Chat sessions</span>
                <strong>{detail.stats?.chat_sessions ?? 0}</strong>
              </div>
            </section>

            <section className="admin-box">
              <h3>Onboarding</h3>
              {detail.profile ? (
                <div className="admin-key-value">
                  <span>Step</span>
                  <strong>{String(detail.profile.onboarding_step ?? "—")}</strong>
                  <span>Completed</span>
                  <strong>{detail.profile.onboarding_completed ? "Yes" : "No"}</strong>
                  <span>Status</span>
                  <strong>{String(detail.profile.ielts_status ?? "—")}</strong>
                  <span>Target level</span>
                  <strong>{String(detail.profile.target_level ?? "—")}</strong>
                </div>
              ) : (
                <p className="admin-thumb">No profile yet.</p>
              )}
              <button className="admin-outline" onClick={() => setConfirmAction("reset")}>
                <RefreshCcw size={14} /> Reset onboarding
              </button>
            </section>

            <section className="admin-box">
              <h3>Sessions</h3>
              {detail.sessions && detail.sessions.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Expires</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.sessions.slice(0, 10).map((session) => (
                        <tr key={session.id}>
                          <td>{session.created_at ? new Date(session.created_at).toLocaleDateString() : "—"}</td>
                          <td>{session.expires_at ? new Date(session.expires_at).toLocaleDateString() : "—"}</td>
                          <td>
                            <span className={session.revoked ? "admin-pill red" : "admin-pill green"}>
                              {session.revoked ? "Revoked" : "Active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-thumb">No active sessions.</p>
              )}
              <button className="admin-btn danger" onClick={() => setConfirmAction("revoke")}>
                <Trash size={14} /> Revoke all sessions
              </button>
            </section>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "revoke" ? "Revoke all sessions" : "Reset onboarding"}
        message={
          confirmAction === "revoke"
            ? "This logs the user out of every device and invalidates all refresh tokens."
            : "This returns the student to the first onboarding step."
        }
        danger={confirmAction === "revoke"}
        confirmLabel={confirmAction === "revoke" ? "Revoke" : "Reset"}
        busy={busy !== ""}
        onConfirm={() => void runAction()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}