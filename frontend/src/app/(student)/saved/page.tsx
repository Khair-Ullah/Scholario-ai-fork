"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type SavedRow = { scholarship_id: string; note: string | null; scholarship: { scholarship_id: string; title: string; university_name: string; host_country: string; deadline_date: string | null } };

export default function SavedPage() {
  const [items, setItems] = useState<SavedRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<SavedRow[]>("/api/saved").then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load saved scholarships.")); }, []);

  async function remove(id: string) {
    try { await apiFetch(`/api/saved/${encodeURIComponent(id)}`, { method: "DELETE" }); setItems((current) => current.filter((item) => item.scholarship_id !== id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove scholarship."); }
  }

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">KEEP THE GOOD ONES CLOSE</p><h1>Your saved scholarships.</h1><p className="page-subtitle">{items.length} opportunities in your list.</p></div><Link className="outline-button" href="/scholarships">Explore matches <ArrowRight size={14} /></Link></section>{error && <p className="form-error" role="alert">{error}</p>}{items.length ? <div className="match-list">{items.map((item) => <div className="match-row saved-row" key={item.scholarship_id}><span className="match-symbol"><Bookmark size={16} color="#26736b" /></span><Link className="match-main" href={`/scholarships/${item.scholarship_id}`}><strong>{item.scholarship.title}</strong><small>{item.scholarship.university_name} · {item.scholarship.host_country}{item.scholarship.deadline_date ? ` · Deadline ${item.scholarship.deadline_date}` : ""}</small>{item.note && <small>{item.note}</small>}</Link><Link className="text-link" href={`/scholarships/${item.scholarship_id}`}>Details <ArrowRight size={14} /></Link><button className="icon-action small-action" aria-label="Remove saved scholarship" onClick={() => remove(item.scholarship_id)}><Trash2 size={15} /></button></div>)}</div> : <div className="empty-state"><Bookmark size={23} /><strong>Your list is ready when you are.</strong><span>Save a scholarship to keep its details and deadline close.</span><Link className="text-link" href="/scholarships">Explore scholarships <ArrowRight size={14} /></Link></div>}</div>;
}