"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  plan: string;
  created_at: string;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  async function load(term = query) {
    try {
      const result = await apiFetch<{ items: AdminUser[] }>(
        `/api/admin/users?q=${encodeURIComponent(term)}`,
      );
      setItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load users.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    apiFetch<{ items: AdminUser[] }>("/api/admin/users?q=")
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Could not load users.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(user: AdminUser, patch: Partial<AdminUser>) {
    try {
      const saved = await apiFetch<AdminUser>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setItems((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, ...saved } : item,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update account.",
      );
    }
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft);
    void load(draft);
  }
  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">ACCOUNT MANAGEMENT</p>
          <h1>Users</h1>
          <p>Search accounts and manage access or plan.</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form className="admin-search" onSubmit={search}>
        <Search size={16} />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search name or email"
        />
        <button className="admin-outline">Search</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Access</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.full_name}</strong>
                  <small>{user.email}</small>
                </td>
                <td>
                  <span className="admin-role-chip">{user.role}</span>
                </td>
                <td>
                  <select
                    value={user.plan}
                    onChange={(event) =>
                      update(user, { plan: event.target.value })
                    }
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                </td>
                <td>
                  <button
                    className={`admin-access ${user.is_active ? "enabled" : "disabled"}`}
                    onClick={() => update(user, { is_active: !user.is_active })}
                  >
                    <ShieldCheck size={13} />
                    {user.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
