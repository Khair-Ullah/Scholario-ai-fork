"use client";

import { useEffect, useState } from "react";
import { BellPlus } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type Announcement } from "@/admin/api";

type Draft = { title: string; body: string; audience: "all" | "pro" | "free"; link: string };

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Draft>({ title: "", body: "", audience: "all", link: "" });

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listAnnouncements(nextPage, 20);
      setItems(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
    let active = true;
    adminApi
      .listAnnouncements(1, 20)
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.total ?? 0);
          setPage(result.page);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load history.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function send() {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setSending(true);
    setError("");
    try {
      const result = await adminApi.sendAnnouncement({
        title: draft.title,
        body: draft.body,
        audience: draft.audience,
        link: draft.link || undefined,
      });
      setToast(`Delivered to ${result.delivered.toLocaleString()} students (${result.audience}).`);
      setDraft({ title: "", body: "", audience: "all", link: "" });
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send announcement.");
    } finally {
      setSending(false);
    }
  }

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      label: "Announcement",
      render: (item) => (
        <>
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </>
      ),
    },
    {
      key: "audience",
      label: "Audience",
      render: (item) => (
        <span className="admin-pill">
          {item.audience ?? "all"} · {item.delivered?.toLocaleString() ?? "—"} recipients
        </span>
      ),
    },
    {
      key: "link",
      label: "Link",
      render: (item) => (item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.link}</a> : <span className="admin-thumb">none</span>),
    },
    {
      key: "sent",
      label: "Sent by",
      render: (item) => (
        <>
          <strong>{item.actor_email ?? "system"}</strong>
          <small>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
        </>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="COMMUNICATIONS"
        title="Announcements"
        description="Send a platform notification to all students, pro members, or free users."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />

      <section className="admin-box">
        <h3>New announcement</h3>
        <div className="admin-announce-form">
          <input placeholder="Headline" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Draft["audience"] })}>
            <option value="all">Everyone</option>
            <option value="pro">Pro members only</option>
            <option value="free">Free users only</option>
          </select>
          <textarea placeholder="Message body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <input placeholder="Optional link (https://…)" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
          <div>
            <button className="admin-btn primary" disabled={sending || !draft.title.trim() || !draft.body.trim()} onClick={() => void send()}>
              <BellPlus size={15} /> {sending ? "Sending..." : "Send announcement"}
            </button>
          </div>
        </div>
      </section>

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyText="No announcements sent yet."
        footer={
          <div className="admin-pagination">
            <span>
              {total} sent · page {page} of {pages}
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