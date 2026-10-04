"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Plane } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Guide = { country: string; official_url: string; steps: string[]; documents: string[]; disclaimer: string };
const countries = ["Australia", "Canada", "France", "Germany", "Japan", "New Zealand", "United Kingdom", "United States"];

export default function VisaTravelPage() {
  const [country, setCountry] = useState("Germany");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Guide>(`/api/visa/${encodeURIComponent(country)}`).then(setGuide).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load this guide.")); }, [country]);
  return <div className="page-stack"><section className="page-heading"><div><p className="eyebrow">A PRACTICAL STARTING POINT</p><h1>Visa & travel notes.</h1><p className="page-subtitle">Check current instructions with the linked official authority.</p></div><label className="sort-select">Destination<select value={country} onChange={(event) => setCountry(event.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select></label></section>{error && <p className="form-error" role="alert">{error}</p>}{guide && <div className="visa-layout"><section className="visa-panel"><div className="visa-panel-title"><span className="quick-icon teal"><Plane size={19} /></span><div><p className="eyebrow">{guide.country.toUpperCase()}</p><h2>Study visa process</h2></div></div><ol className="visa-steps">{guide.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol><a href={guide.official_url} target="_blank" rel="noreferrer" className="text-link">Official government information <ArrowUpRight size={14} /></a><p className="input-hint">{guide.disclaimer}</p></section><aside className="visa-panel"><p className="eyebrow">DOCUMENTS TO CHECK</p><ul className="visa-doc-list">{guide.documents.map((document) => <li key={document}>{document}</li>)}</ul></aside></div>}</div>;
}