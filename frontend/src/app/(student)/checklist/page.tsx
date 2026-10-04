"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ChecklistItem = { id: number; scholarship_id: string | null; title: string; is_done: boolean; due_date: string | null; category: string | null };

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<ChecklistItem[]>("/api/checklist").then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load your checklist.")); }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await apiFetch<ChecklistItem>("/api/checklist", { method: "POST", body: JSON.stringify({ title, category: "Personal" }) });
      setItems((current) => [...current, created]); setTitle("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add checklist item."); }
  }

  async function toggle(item: ChecklistItem) {
    try {
      const updated = await apiFetch<ChecklistItem>(`/api/checklist/${item.id}`, { method: "PATCH", body: JSON.stringify({ is_done: !item.is_done }) });
      setItems((current) => current.map((row) => row.id === item.id ? updated : row));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update checklist item."); }
  }

  async function remove(id: number) {
    try { await apiFetch(`/api/checklist/${id}`, { method: "DELETE" }); setItems((current) => current.filter((item) => item.id !== id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete checklist item."); }
  }

  const completed = items.filter((item) => item.is_done).length;
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">MAKE THE NEXT STEP SMALLER</p><h1>Your preparation checklist.</h1><p className="page-subtitle">{completed} of {items.length} items complete.</p></div><span className="checklist-progress"><span style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }} /></span></section>{error && <p className="form-error" role="alert">{error}</p>}<form className="checklist-add" onSubmit={add}><input aria-label="New checklist item" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task to your list" /><button className="primary-button" aria-label="Add task"><Plus size={16} /> Add item</button></form>{items.length ? <div className="checklist-list">{items.map((item) => <div className={`checklist-row ${item.is_done ? "complete" : ""}`} key={item.id}><button className={`checkbox-action ${item.is_done ? "checked" : ""}`} onClick={() => toggle(item)} aria-label={item.is_done ? "Mark incomplete" : "Mark complete"}>{item.is_done && <Check size={14} />}</button><div className="checklist-item-copy"><strong>{item.title}</strong><span>{item.category || "Personal"}{item.due_date ? ` · Due ${item.due_date}` : ""}{item.scholarship_id ? <Link href={`/scholarships/${item.scholarship_id}`}> · Scholarship</Link> : null}</span></div><button className="icon-action small-action" aria-label="Delete checklist item" onClick={() => remove(item.id)}><Trash2 size={14} /></button></div>)}</div> : <div className="empty-state"><ClipboardCheck size={24} /><strong>One thing at a time.</strong><span>Add a personal task or create a scholarship-specific list from its detail page.</span><Link className="text-link" href="/scholarships">Browse scholarships <ArrowRight size={14} /></Link></div>}</div>;
}