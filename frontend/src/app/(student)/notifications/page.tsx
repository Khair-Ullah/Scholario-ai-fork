"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Notice = { id: number; title: string; body: string; kind: string; link: string | null; is_read: boolean; created_at: string };
type NoticeResponse = { items: Notice[]; unread_count: number };

function isSafeLink(link: string | null): link is string {
  if (!link) return false;
  if (link.startsWith("/") && !link.startsWith("//") && !link.includes("\\")) return true;
  return /^https?:\/\//i.test(link);
}

export default function NotificationsPage() {
  const [data, setData] = useState<NoticeResponse>({ items: [], unread_count: 0 });
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<NoticeResponse>("/api/notifications").then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load notifications.")); }, []);
  async function markAll() {
    try { await apiFetch("/api/notifications/read-all", { method: "POST" }); setData((current) => ({ ...current, unread_count: 0, items: current.items.map((item) => ({ ...item, is_read: true })) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notifications."); }
  }
  async function markOne(item: Notice) {
    if (item.is_read) return;
    try { await apiFetch(`/api/notifications/${item.id}/read`, { method: "PATCH" }); setData((current) => ({ ...current, unread_count: Math.max(0, current.unread_count - 1), items: current.items.map((notice) => notice.id === item.id ? { ...notice, is_read: true } : notice) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notification."); }
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A FEW THINGS TO KEEP IN VIEW</p><h1>Notifications.</h1><p className="page-subtitle">{data.unread_count} unread</p></div>{data.unread_count > 0 && <button className="outline-button" onClick={markAll}><Check size={14} /> Mark all read</button>}</section>{error && <p className="form-error" role="alert">{error}</p>}{data.items.length ? <div className="notification-list">{data.items.map((item) => <article key={item.id} className={`notification-row ${item.is_read ? "read" : "unread"}`}><span className="quick-icon teal"><Bell size={16} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleDateString()} · {item.kind}</small></div>{isSafeLink(item.link) ? <Link href={item.link} aria-label="Open notification"><ArrowRight size={15} /></Link> : !item.is_read ? <button className="text-link" onClick={() => markOne(item)}>Mark read</button> : null}</article>)}</div> : <div className="empty-state"><Bell size={22} /><strong>Nothing needs your attention just yet.</strong><span>Deadline reminders and account updates will appear here.</span></div>}</div>;
}