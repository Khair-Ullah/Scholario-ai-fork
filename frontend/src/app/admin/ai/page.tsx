"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, MessageSquareText, Sparkles } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { StatCard } from "@/admin/components/StatCard";
import { adminApi, type AiStats } from "@/admin/api";

export default function AdminAiPage() {
  const [data, setData] = useState<AiStats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    adminApi
      .aiStats()
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load AI stats.");
      });
    return () => {
      active = false;
    };
  }, []);

  const columns: Column<AiStats["recent_sessions"][number]>[] = [
    {
      key: "session",
      label: "Session",
      render: (session) => (
        <>
          <strong>{session.title}</strong>
          <small>{session.id}</small>
        </>
      ),
    },
    {
      key: "user",
      label: "Student",
      render: (session) => session.user_email ?? "—",
    },
    {
      key: "messages",
      label: "Messages",
      render: (session) => session.messages,
    },
    {
      key: "started",
      label: "Started",
      render: (session) => (session.created_at ? new Date(session.created_at).toLocaleString() : "—"),
    },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="ARTIFICIAL INTELLIGENCE"
        title="AI activity"
        description="Token and usage overview across the advisor, matching and review tools."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stat-grid">
        <StatCard label="Total sessions" value={data?.sessions} icon={Bot} />
        <StatCard label="Messages (7d)" value={data?.messages_7d} icon={MessageSquareText} />
        <StatCard label="Total tokens" value={data?.tokens_total} icon={Activity} />
        <StatCard label="Provider calls" value={Object.values(data?.by_provider ?? {}).reduce((a, b) => a + b, 0)} icon={Sparkles} />
      </div>
      <section className="admin-box">
        <h3>Recent sessions</h3>
        <DataTable
          columns={columns}
          rows={data?.recent_sessions ?? []}
          loading={!data}
          emptyText="No AI sessions yet."
        />
      </section>
    </div>
  );
}