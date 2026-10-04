"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

const statuses = ["planning", "in_progress", "submitted", "interview", "accepted", "rejected", "withdrawn"] as const;
type Status = typeof statuses[number];
type Application = { id: number; scholarship_id: string; status: Status; next_step: string | null; next_step_date: string | null; notes: string | null; scholarship: { title: string; university_name: string; host_country: string; deadline_date: string | null } };

export default function TrackerPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Application[]>("/api/applications").then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your tracker.")); }, []);

  async function changeStatus(item: Application, status: Status) {
    try {
      const updated = await apiFetch<Application>(`/api/applications/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: updated.status } : entry));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update application."); }
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">ONE STEP AT A TIME</p><h1>Your application tracker.</h1><p className="page-subtitle">{items.length} opportunities in progress.</p></div><Link className="outline-button" href="/scholarships">Add a scholarship <ArrowRight size={14} /></Link></section>{error && <p className="form-error" role="alert">{error}</p>}{items.length ? <div className="tracker-board">{statuses.map((status) => <section className="tracker-column" key={status}><h2>{status.replace("_", " ")}<span>{items.filter((item) => item.status === status).length}</span></h2>{items.filter((item) => item.status === status).map((item) => <article className="tracker-item" key={item.id}><Link href={`/scholarships/${item.scholarship_id}`}><strong>{item.scholarship.title}</strong><small>{item.scholarship.university_name}</small></Link><span className="tracker-country">{item.scholarship.host_country}</span>{item.scholarship.deadline_date && <span className="tracker-date"><CalendarClock size={13} /> {item.scholarship.deadline_date}</span>}<label className="status-change">Move to<select value={item.status} onChange={(event) => changeStatus(item, event.target.value as Status)}>{statuses.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label></article>)}</section>)}</div> : <div className="empty-state"><ClipboardCheck size={24} /><strong>Your tracker is ready.</strong><span>Add a scholarship to plan its next steps and keep its deadline in view.</span><Link className="text-link" href="/scholarships">Find a scholarship <ArrowRight size={14} /></Link></div>}</div>;
}