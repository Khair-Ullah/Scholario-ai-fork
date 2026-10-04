"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Search, SlidersHorizontal } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Match = { scholarship_id: string; title: string; university_name: string; host_country: string; level: string; scholarship_type: string; ielts_tier: number; deadline_date: string | null; deadline_kind: string; selection_ratio_percent: number | null; stipend_monthly_usd: string | null; chance_label: string };
type Results = { items: Match[]; total: number; page: number; page_size: number; gpa_missing?: boolean; final_tier_cap?: number; message?: string };

export default function ScholarshipsPage() {
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("best_chance");

  useEffect(() => {
    apiFetch<Results>("/api/scholarships/match", { method: "POST", body: JSON.stringify({ page, page_size: 20 }) })
      .then(setResults).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load matches."));
  }, [page]);

  const filtered = (results?.items || []).filter((item) => `${item.title} ${item.university_name} ${item.host_country}`.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => sort === "deadline" ? (a.deadline_date || "9999").localeCompare(b.deadline_date || "9999") : sort === "funding" ? Number(b.stipend_monthly_usd || 0) - Number(a.stipend_monthly_usd || 0) : (b.selection_ratio_percent || -1) - (a.selection_ratio_percent || -1));

  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">THE SHORTLIST, STARTS HERE</p><h1>Scholarships for your next step.</h1><p className="page-subtitle">{results ? `${results.total.toLocaleString()} matched opportunities` : "Finding your matches..."}{results?.final_tier_cap !== undefined ? ` · IELTS tiers up to ${results.final_tier_cap}` : ""}</p></div><Link className="outline-button" href="/onboarding"><SlidersHorizontal size={15} /> Edit preferences</Link></section>
    {results?.gpa_missing && <div className="notice-strip">Add your academic score for sharper results. <Link href="/onboarding">Add score <ArrowRight size={14} /></Link></div>}
    <div className="results-toolbar"><label className="results-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your matches" aria-label="Search your matches" /></label><label className="sort-select">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best_chance">Best chance</option><option value="deadline">Deadline soonest</option><option value="funding">Highest stipend</option></select></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}{results?.message && <div className="empty-state"><Compass size={24} /><strong>Your preferences will shape this list.</strong><span>{results.message}</span><Link className="primary-button" href="/onboarding">Set study preferences <ArrowRight size={15} /></Link></div>}
    {sorted.length > 0 && <><div className="result-grid">{sorted.map((item) => <article className="result-card" key={item.scholarship_id}><div className="result-card-top"><span className="funding-tag">{item.scholarship_type || "Scholarship"}</span><span className={`chance-dot ${item.chance_label === "Good chance" ? "good" : item.chance_label === "Moderate" ? "moderate" : "competitive"}`} /> </div><h2>{item.title}</h2><p className="result-university">{item.university_name} <span>·</span> {item.host_country}</p><div className="result-facts"><span>{item.level}</span><span>{item.ielts_tier === 0 ? "No IELTS" : `${item.ielts_tier * 2 + 4}+ IELTS`}</span><span>{item.deadline_kind === "fixed" ? item.deadline_date : item.deadline_kind}</span></div><div className="result-chance"><div><strong>{item.selection_ratio_percent == null ? "—" : `${item.selection_ratio_percent}%`}</strong><span>{item.chance_label} <small>· estimate</small></span></div><div className="chance-bar"><span style={{ width: `${Math.min(item.selection_ratio_percent || 0, 100)}%` }} /></div></div><Link className="result-link" href={`/scholarships/${item.scholarship_id}`}>View scholarship <ArrowRight size={15} /></Link></article>)}</div><div className="pagination"><button className="outline-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} · {results?.total || 0} results</span><button className="outline-button" disabled={page * 20 >= (results?.total || 0)} onClick={() => setPage((current) => current + 1)}>Next</button></div></>}
    {results && !results.message && sorted.length === 0 && <div className="empty-state"><Search size={24} /><strong>No scholarships found</strong><span>Try another search or broaden your profile preferences.</span><button className="text-link" onClick={() => setQuery("")}>Clear search</button></div>}
  </div>;
}