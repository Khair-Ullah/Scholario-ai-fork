"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Compass, FileText, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

type MatchItem = { scholarship_id: string; title: string; university_name: string; host_country: string; scholarship_type: string; deadline_kind: string; selection_ratio_percent: number | null; chance_label: string };
type MatchResponse = { items: MatchItem[]; total: number; message?: string };
type Onboarding = { profile: { onboarding_completed: boolean } | null; full_name: string };

export default function DashboardPage() {
  const [name, setName] = useState("there");
  const [matches, setMatches] = useState<MatchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<Onboarding>("/api/onboarding"), apiFetch<MatchResponse>("/api/scholarships/match", { method: "POST", body: JSON.stringify({ page: 1, page_size: 5 }) })])
      .then(([onboarding, results]) => { setName(onboarding.full_name.split(" ")[0] || "there"); setMatches(results); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load your dashboard."));
  }, []);

  return <div className="page-stack"><section className="page-heading dashboard-heading"><div><p className="eyebrow">YOUR SCHOLARSHIP DESK</p><h1>Good to see you, {name}.</h1><p className="page-subtitle">A steady place to plan what comes next.</p></div><Link className="outline-button" href="/onboarding">Edit preferences</Link></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="welcome-strip"><div className="welcome-icon"><Sparkles size={20} /></div><div><p className="welcome-kicker">YOUR NEXT STEP</p><h2>{matches?.message || (matches?.total ? `${matches.total} scholarships fit your current profile.` : "Start by setting your study preferences.")}</h2><p>Matching uses your degree, destination, field, IELTS choice, and academic score.</p></div><Link href={matches?.total ? "/scholarships" : "/onboarding"} aria-label="Continue to your next step"><ArrowRight size={20} /></Link></section>
    <section className="quick-actions"><Link href="/scholarships"><span className="quick-icon teal"><Compass size={19} /></span><span><strong>Explore scholarships</strong><small>Browse the catalogue</small></span><ArrowRight size={16} /></Link><Link href="/tracker"><span className="quick-icon gold"><CalendarClock size={19} /></span><span><strong>Application tracker</strong><small>Keep deadlines in view</small></span><ArrowRight size={16} /></Link><Link href="/templates"><span className="quick-icon green"><FileText size={19} /></span><span><strong>Prepare a document</strong><small>Start with a template</small></span><ArrowRight size={16} /></Link></section>
    <section className="section-heading"><div><p className="eyebrow">A FIRST LOOK</p><h2>Your top matches</h2></div><Link href="/scholarships" className="text-link">See all <ArrowRight size={15} /></Link></section>
    {matches?.items?.length ? <div className="match-list">{matches.items.map((item) => <Link className="match-row" href={`/scholarships/${item.scholarship_id}`} key={item.scholarship_id}><span className="match-symbol"><GraduationCapIcon /></span><span className="match-main"><strong>{item.title}</strong><small>{item.university_name} · {item.host_country}</small></span><span className="chance-tag">{item.chance_label}</span><ArrowRight size={16} /></Link>)}</div> : <div className="empty-state"><Compass size={24} /><strong>No matches yet</strong><span>Complete your study preferences to see scholarships that fit.</span><Link href="/onboarding" className="text-link">Set preferences <ArrowRight size={15} /></Link></div>}
  </div>;
}

function GraduationCapIcon() { return <span className="cap-glyph">S</span>; }