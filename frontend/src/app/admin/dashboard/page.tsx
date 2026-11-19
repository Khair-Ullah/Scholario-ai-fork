"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  FileSpreadsheet,
  FileText,
  ShieldOff,
  Sparkles,
  Users,
} from "lucide-react";
import { EmptyState } from "@/admin/components/EmptyState";
import { PageHeader } from "@/admin/components/PageHeader";
import { StatCard } from "@/admin/components/StatCard";
import { Skeleton } from "@/admin/components/Skeleton";
import { adminApi, type AdminStats } from "@/admin/api";

function MiniBar({ values }: { values: { date: string; count: number }[] }) {
  if (values.length === 0) return <p className="admin-table-foot">No signups yet this week.</p>;
  const peak = Math.max(1, ...values.map((entry) => entry.count));
  return (
    <div className="admin-bar-chart" role="img" aria-label="Signups per day">
      {values.map((entry) => (
        <div className="admin-bar-col" key={entry.date} title={`${entry.date}: ${entry.count}`}>
          <span style={{ height: `${Math.round((entry.count / peak) * 100)}%` }} />
          <small>{new Date(entry.date).toLocaleDateString(undefined, { day: "2-digit" })}</small>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    adminApi
      .stats()
      .then((loaded) => {
        if (active) setStats(loaded);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load statistics.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="SYSTEM OVERVIEW"
        title="Operations dashboard"
        description="Core catalogue, account and engagement metrics."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stat-grid">
        <StatCard label="Scholarships" value={stats?.scholarships} icon={FileSpreadsheet} href="/admin/scholarships" />
        <StatCard label="Active listings" value={stats?.active_scholarships} icon={FileSpreadsheet} href="/admin/scholarships" />
        <StatCard label="Student accounts" value={stats?.users} icon={Users} href="/admin/users" />
        <StatCard label="New today" value={stats?.new_today} icon={Users} href="/admin/users" />
        <StatCard label="Pro accounts" value={stats?.pro_users} icon={Sparkles} href="/admin/users" />
        <StatCard label="Saved opportunities" value={stats?.saved} icon={Database} href="/admin/users" />
        <StatCard label="Tracked applications" value={stats?.applications} icon={Database} href="/admin/users" />
        <StatCard label="Uploaded documents" value={stats?.documents} icon={FileText} href="/admin/users" />
        <StatCard label="AI messages (7d)" value={stats?.ai_messages_7d} icon={Activity} href="/admin/ai" />
      </div>

      <section className="admin-box">
        <h3>Signups — last 14 days</h3>
        {stats ? (
          <MiniBar values={(stats.signups_by_day ?? []).slice(-14)} />
        ) : (
          <div className="admin-empty">
            <Skeleton />
          </div>
        )}
      </section>

      <section className="admin-box">
        <h3>Most-saved scholarships</h3>
        {stats ? (
          (stats.top_saved ?? []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Scholarship</th>
                    <th>Saves</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.top_saved ?? []).map((row) => (
                    <tr key={row.scholarship_id}>
                      <td>
                        <strong>{row.title}</strong>
                        <small>{row.scholarship_id}</small>
                      </td>
                      <td>{row.saves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="No saved scholarships yet." />
          )
        ) : (
          <div className="admin-empty">
            <Skeleton />
          </div>
        )}
      </section>

      <section className="admin-box">
        <h3>Latest accounts</h3>
        {stats ? (
          (stats.latest_users ?? []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.latest_users ?? []).map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.full_name || "—"}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="No accounts yet." />
          )
        ) : (
          <div className="admin-empty">
            <Skeleton />
          </div>
        )}
      </section>

      <section className="admin-section">
        <div>
          <p className="admin-eyebrow">CATALOGUE HEALTH</p>
          <h2>Keep the data dependable.</h2>
          <p>Review unresolved university countries and correct application links.</p>
        </div>
        <Link className="admin-outline" href="/admin/data-quality">
          Open data quality <ArrowRight size={14} />
        </Link>
      </section>
      <section className="admin-section">
        <div>
          <p className="admin-eyebrow">ACCOUNT SAFETY</p>
          <h2>Monitor access and sessions.</h2>
          <p>Revoke stale logins and review onboarding state.</p>
        </div>
        <Link className="admin-outline" href="/admin/users">
          Open users <ShieldOff size={14} />
        </Link>
      </section>
    </div>
  );
}