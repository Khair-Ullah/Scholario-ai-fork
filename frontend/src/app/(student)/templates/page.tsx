"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Template = { id: number; slug: string; title: string; category: string; description: string; is_premium: boolean; recommended_word_range: number[] };
const categories = ["All", "Essays", "Letters", "Emails", "Research", "CV", "Visa"];

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Template[]>("/api/templates").then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load templates.")); }, []);
  const visible = items.filter((item) => (category === "All" || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A GOOD FIRST DRAFT</p><h1>Document templates.</h1><p className="page-subtitle">A place to get your ideas moving.</p></div><Link href="/templates/my-documents" className="outline-button">My documents <ArrowRight size={14} /></Link></section>{error && <p className="form-error" role="alert">{error}</p>}<label className="results-search template-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a template" /></label><div className="template-tabs" role="tablist">{categories.map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="template-grid">{visible.map((item) => <Link className="template-row" href={`/templates/${item.slug}`} key={item.slug}><span className="template-icon"><FileText size={18} /></span><span className="template-copy"><strong>{item.title}</strong><small>{item.category} · {item.description}</small></span><span className="template-length">{item.recommended_word_range?.[1] ? `${item.recommended_word_range[0]}–${item.recommended_word_range[1]} words` : item.category}</span><ArrowRight size={15} /></Link>)}</div>{visible.length === 0 && <div className="empty-state"><FileText size={22} /><strong>No templates match that search.</strong><span>Try another title or category.</span></div>}</div>;
}