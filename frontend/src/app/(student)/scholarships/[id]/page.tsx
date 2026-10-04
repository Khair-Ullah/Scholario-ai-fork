"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bookmark, CalendarDays, Check, GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Detail = {
  scholarship_id: string;
  title: string;
  university_name: string;
  host_country: string;
  level: string;
  scholarship_type: string;
  description_html?: string;
  description_text?: string;
  application_url: string;
  application_url_is_search_fallback: boolean;
  selection_ratio_percent: number | null;
  chance_label: string;
  deadline_date: string | null;
  deadline_kind: string;
  ielts_tier: number;
  fields_list: string[];
  docs_list?: string[];
  duration_months?: string | number | null;
  intake_term?: string | null;
  cycle_status?: string | null;
  source_language?: string | null;
  rolling_admission?: string | boolean | null;
  short_description?: string | null;
  min_degree_required?: string | null;
  degree_field_restriction?: string | null;
  graduation_window?: string | null;
  final_year_students_can_apply?: string | boolean | null;
  IELTS_band_recommendation?: string | null;
  local_language_test?: string | null;
  grant_amount_formatted?: string | null;
  tuition_covered?: string | number | null;
  stipend_monthly_amount?: string | null;
  health_insurance_covered?: string | boolean | null;
  language_course_included?: string | boolean | null;
  [key: string]: unknown;
};

export default function ScholarshipDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isTracked, setIsTracked] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<Detail>(`/api/scholarships/${encodeURIComponent(params.id)}`).then(setDetail).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load scholarship."));
    apiFetch<{ scholarship_id: string }[]>("/api/saved").then((saved) => setIsSaved(saved.some((item) => item.scholarship_id === params.id))).catch(() => {});
    apiFetch<{ scholarship_id: string }[]>("/api/applications").then((applications) => setIsTracked(applications.some((item) => item.scholarship_id === params.id))).catch(() => {});
  }, [params.id]);

  async function toggleSaved() {
    if (busy) return;
    setBusy(true); setActionMessage("");
    try {
      if (isSaved) await apiFetch(`/api/saved/${encodeURIComponent(params.id)}`, { method: "DELETE" });
      else await apiFetch("/api/saved", { method: "POST", body: JSON.stringify({ scholarship_id: params.id }) });
      setIsSaved(!isSaved);
      setActionMessage(isSaved ? "Removed from saved." : "Saved to your list.");
    } catch (cause) { setActionMessage(cause instanceof Error ? cause.message : "Could not update saved scholarships."); }
    finally { setBusy(false); }
  }

  async function addToTracker() {
    if (busy || isTracked) return;
    setBusy(true); setActionMessage("");
    try {
      await apiFetch("/api/applications", { method: "POST", body: JSON.stringify({ scholarship_id: params.id, status: "planning" }) });
      setIsTracked(true); setActionMessage("Added to your application tracker.");
    } catch (cause) { setActionMessage(cause instanceof Error ? cause.message : "Could not update your tracker."); }
    finally { setBusy(false); }
  }

  async function generateChecklist() {
    setBusy(true); setActionMessage("");
    try {
      const added = await apiFetch<unknown[]>(`/api/checklist/generate/${encodeURIComponent(params.id)}`, { method: "POST" });
      setActionMessage(added.length ? `${added.length} checklist items added.` : "Your checklist already includes these items.");
    } catch (cause) { setActionMessage(cause instanceof Error ? cause.message : "Could not create checklist items."); }
    finally { setBusy(false); }
  }

  if (error) return <div className="empty-state"><strong>Scholarship unavailable</strong><span>{error}</span><Link href="/scholarships" className="text-link"><ArrowLeft size={15} /> Back to matches</Link></div>;
  if (!detail) return <div className="loading-line">Loading scholarship details...</div>;
  const about = detail.description_html || detail.description_text || detail.short_description || "Description has not been provided.";
  const facts: [string, unknown][] = [["Course level", detail.level], ["Duration", detail.duration_months ? `${detail.duration_months} months` : null], ["Intake", detail.intake_term], ["Cycle", detail.cycle_status], ["Language", detail.source_language]];
  const eligibilityFacts: [string, unknown][] = [["Minimum degree", detail.min_degree_required], ["Field restriction", detail.degree_field_restriction], ["Graduation window", detail.graduation_window], ["Final-year applicants", detail.final_year_students_can_apply], ["IELTS band", detail.IELTS_band_recommendation], ["Language test", detail.local_language_test]];
  const fundingFacts: [string, unknown][] = [["Award", detail.grant_amount_formatted], ["Tuition covered", detail.tuition_covered ? `${detail.tuition_covered}%` : null], ["Monthly stipend", detail.stipend_monthly_amount], ["Health insurance", detail.health_insurance_covered], ["Language course", detail.language_course_included]];

  return <div className="page-stack detail-page"><Link href="/scholarships" className="text-link"><ArrowLeft size={15} /> Back to matches</Link><section className="detail-hero"><p className="eyebrow">SCHOLARSHIP OPPORTUNITY</p><div className="detail-title-row"><div><h1>{detail.title}</h1><p className="detail-school"><GraduationCap size={17} /> {detail.university_name} <span>·</span> <MapPin size={15} /> {detail.host_country}</p></div><button className={`icon-action ${isSaved ? "is-saved" : ""}`} title={isSaved ? "Remove saved scholarship" : "Save scholarship"} aria-label={isSaved ? "Remove saved scholarship" : "Save scholarship"} onClick={toggleSaved} disabled={busy}>{isSaved ? <Check size={19} /> : <Bookmark size={19} />}</button></div><div className="detail-badges"><span>{detail.level}</span><span>{detail.scholarship_type}</span><span>{detail.ielts_tier === 0 ? "No IELTS" : `${detail.ielts_tier * 2 + 4}+ IELTS`}</span></div><div className="detail-actions"><a href={detail.application_url} target="_blank" rel="noreferrer" className="primary-button">Apply now <ArrowUpRight size={16} /></a><button className="outline-button" onClick={addToTracker} disabled={busy || isTracked}>{isTracked ? <Check size={15} /> : <CalendarDays size={15} />}{isTracked ? "In tracker" : "Add to tracker"}</button><Link href="/templates" className="outline-button">Prepare documents</Link><button className="outline-button" onClick={() => window.print()}>Print details</button></div>{detail.application_url_is_search_fallback && <p className="input-hint">Official application link not added yet. This button opens a web search.</p>}{actionMessage && <p className="action-message" role="status">{actionMessage}</p>}</section>
    <div className="detail-columns"><div className="detail-main"><section className="detail-section"><p className="eyebrow">THE OPPORTUNITY</p><h2>About this scholarship</h2>{typeof about === "string" && about.includes("<") ? <div className="detail-description" dangerouslySetInnerHTML={{ __html: about }} /> : <p className="detail-description">{String(about)}</p>}</section><section className="detail-section"><p className="eyebrow">THE DETAILS</p><h2>At a glance</h2><div className="fact-grid">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}<div><span>Deadline</span><strong>{detail.deadline_date || detail.deadline_kind}</strong></div><div><span>Rolling admission</span><strong>{String(detail.rolling_admission || "Not specified")}</strong></div></div></section><section className="detail-section"><p className="eyebrow">WHO CAN APPLY</p><h2>Eligibility & requirements</h2><div className="fact-grid">{eligibilityFacts.filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}</div><div className="detail-chip-list">{detail.fields_list?.map((field) => <span key={field}>{field}</span>)}</div></section><section className="detail-section"><p className="eyebrow">WHAT TO PREPARE</p><h2>Application documents</h2><div className="fact-grid">{detail.docs_list?.map((doc) => <div key={doc}><ShieldCheck size={16} /><strong>{doc}</strong></div>)}</div><button className="text-link checklist-generate" onClick={generateChecklist} disabled={busy}>Add all to my checklist <ArrowUpRight size={14} /></button></section></div><aside className="detail-aside"><section className="chance-panel"><p className="eyebrow">COMPETITION · ESTIMATE</p><strong className="chance-number">{detail.selection_ratio_percent == null ? "—" : `${detail.selection_ratio_percent}%`}</strong><span className="chance-label">{detail.chance_label}</span><div className="chance-meter"><span style={{ width: `${Math.min(detail.selection_ratio_percent || 0, 100)}%` }} /></div><p>Estimated selection ratio for Pakistani applicants. This is not an individual probability.</p></section><section className="detail-side-facts"><p className="eyebrow">FUNDING SNAPSHOT</p>{fundingFacts.filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><strong>{String(value)}</strong></div>)}<span className="estimate-note"><CalendarDays size={14} /> Confirm dates with the official source.</span></section></aside></div></div>;
}