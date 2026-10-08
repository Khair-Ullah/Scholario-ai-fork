"use client";

import { useEffect, useState } from "react";
import { Check, Database, MapPin, Search } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { adminApi, type DataQualityQueue, type DataQualityResponse } from "@/admin/api";

type UniversityRow = { university_name: string; host_country: string; confidence: number };
type ScholarshipRow = Record<string, unknown> & { scholarship_id: string; title?: string };

const QUEUES: { value: DataQualityQueue; label: string }[] = [
  { value: "unmapped", label: "Unmapped universities" },
  { value: "missing_deadline", label: "Missing deadline" },
  { value: "missing_url", label: "Missing application URL" },
  { value: "ielts_missing_band", label: "IELTS missing band" },
];

const COUNTRY_OPTIONS = [
  "Austria", "Australia", "Belgium", "Canada", "China", "Denmark", "Finland", "France",
  "Germany", "Hong Kong", "India", "Ireland", "Italy", "Japan", "Malaysia", "Netherlands",
  "New Zealand", "Norway", "Singapore", "South Korea", "Spain", "Sweden", "Switzerland",
  "Turkey", "United Arab Emirates", "United Kingdom", "United States", "Unknown",
];

export default function AdminDataQualityPage() {
  const [queue, setQueue] = useState<DataQualityQueue>("unmapped");
  const [result, setResult] = useState<DataQualityResponse | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyName, setBusyName] = useState("");

  async function load(nextQueue = queue, page = 1) {
    setError("");
    try {
      const loaded = await adminApi.dataQuality(nextQueue, page, 50);
      setResult(loaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load queue.");
    }
  }

useEffect(() => {
    let active = true;
    adminApi
      .dataQuality("unmapped", 1, 50)
      .then((loaded) => {
        if (active) setResult(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load queue.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function switchQueue(next: DataQualityQueue) {
    setQueue(next);
    void load(next, 1);
  }

  async function saveCountry(row: UniversityRow, hostCountry: string) {
    if (!hostCountry) return;
    setBusyName(row.university_name);
    setError("");
    try {
      await adminApi.updateUniversityCountry(row.university_name, hostCountry, 1);
      setToast(`Updated ${row.university_name}.`);
      await load(queue);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update country.");
    } finally {
      setBusyName("");
    }
  }

  const unmapped = (result?.items ?? []).filter((item) => "university_name" in item) as UniversityRow[];
  const rows = (result?.items ?? []).filter((item) => "scholarship_id" in item) as ScholarshipRow[];

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CATALOGUE QUALITY"
        title="Data quality"
        description="Resolve unresolved countries, missing deadlines, URLs and IELTS band fields."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <div className="admin-tabs" role="tablist">
        {QUEUES.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={queue === value}
            className={queue === value ? "active" : ""}
            onClick={() => switchQueue(value)}
          >
            {label}
            <span className="admin-tab-count">{result?.counts?.[value]?.toLocaleString() ?? "…"}</span>
          </button>
        ))}
      </div>

      {queue === "unmapped" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>University / provider</th>
                <th>Current match</th>
                <th>Choose country</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {unmapped.map((item) => (
                <UnmappedRow key={item.university_name} row={item} busy={busyName === item.university_name} onSave={(country) => void saveCountry(item, country)} />
              ))}
            </tbody>
          </table>
          {unmapped.length === 0 && !error && (
            <div className="admin-empty">
              <Database size={20} /> <strong>No unresolved rows in this view.</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Scholarship</th>
                <th>University</th>
                <th>Host</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.scholarship_id}>
                  <td>
                    <strong>{item.title ?? item.scholarship_id}</strong>
                    <small>{item.scholarship_id}</small>
                  </td>
                  <td>{String(item.university_name ?? "—")}</td>
                  <td>{String(item.host_country ?? "—")}</td>
                  <td>{item.application_url ? <a href={String(item.application_url)} target="_blank" rel="noreferrer">{String(item.application_url)}</a> : <span className="admin-thumb">none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !error && (
            <div className="admin-empty">
              <Check size={20} /> <strong>Queue is clear — no rows match.</strong>
            </div>
          )}
        </div>
      )}
      <p className="admin-table-foot">
        <Search size={12} /> {result?.total?.toLocaleString() ?? 0} row(s) in this queue.
      </p>
    </div>
  );
}

function UnmappedRow({
  row,
  busy,
  onSave,
}: {
  row: UniversityRow;
  busy: boolean;
  onSave: (country: string) => void;
}) {
  const [country, setCountry] = useState(row.host_country);
  return (
    <tr>
      <td>
        <strong>{row.university_name}</strong>
      </td>
      <td>
        <span className="admin-thumb">
          <MapPin size={12} /> {row.host_country} · {row.confidence.toFixed(2)}
        </span>
      </td>
      <td>
        <select value={country} onChange={(event) => setCountry(event.target.value)}>
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </td>
      <td>
        <button className="admin-save" disabled={busy || !country} onClick={() => onSave(country)}>
          <Check size={13} /> Save
        </button>
      </td>
    </tr>
  );
}