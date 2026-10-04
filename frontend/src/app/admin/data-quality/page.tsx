"use client";

import { useEffect, useState } from "react";
import { Check, Database } from "lucide-react";
import { apiFetch } from "@/lib/api";

type University = {
  university_name: string;
  host_country: string;
  confidence: number;
};
const countryOptions = [
  "Australia",
  "Canada",
  "China",
  "France",
  "Germany",
  "Hong Kong",
  "India",
  "Ireland",
  "Japan",
  "Malaysia",
  "Netherlands",
  "New Zealand",
  "Singapore",
  "South Korea",
  "Sweden",
  "Switzerland",
  "Türkiye",
  "United Kingdom",
  "United States",
  "Unknown",
];

export default function AdminDataQualityPage() {
  const [items, setItems] = useState<University[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<University[]>("/api/admin/universities/unmapped")
      .then((loaded) => {
        if (active) setItems(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load unmapped universities.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(item: University) {
    try {
      await apiFetch(
        `/api/admin/universities/${encodeURIComponent(item.university_name)}/country`,
        {
          method: "PATCH",
          body: JSON.stringify({
            host_country: item.host_country,
            confidence: 1,
          }),
        },
      );
      setMessage(`Updated ${item.university_name}.`);
      setItems((current) =>
        current.filter((row) => row.university_name !== item.university_name),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update country.",
      );
    }
  }
  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">CATALOGUE QUALITY</p>
          <h1>Unmapped universities</h1>
          <p>Choose a host country; the change updates related scholarships.</p>
        </div>
        <span className="admin-role-chip">{items.length} displayed</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="action-message" role="status">
          {message}
        </p>
      )}
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
            {items.map((item) => (
              <tr key={item.university_name}>
                <td>
                  <strong>{item.university_name}</strong>
                </td>
                <td>
                  {item.host_country} · {item.confidence.toFixed(2)}
                </td>
                <td>
                  <select
                    value={item.host_country}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.university_name === item.university_name
                            ? { ...row, host_country: event.target.value }
                            : row,
                        ),
                      )
                    }
                  >
                    {countryOptions.map((country) => (
                      <option key={country}>{country}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="admin-save" onClick={() => save(item)}>
                    <Check size={13} /> Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="admin-empty">
            <Database size={20} />
            <strong>No unresolved rows in this view.</strong>
          </div>
        )}
      </div>
    </div>
  );
}
