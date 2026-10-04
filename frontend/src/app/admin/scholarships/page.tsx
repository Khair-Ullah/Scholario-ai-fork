"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowRight, Search, Upload } from "lucide-react";
import { API_URL, apiFetch } from "@/lib/api";

type Scholarship = {
  scholarship_id: string;
  title: string;
  university_name: string;
  host_country: string;
  application_url: string | null;
  level: string;
  scholarship_type: string;
  is_active: boolean;
};
type Results = { items: Scholarship[]; page: number; page_size: number };

export default function AdminScholarshipsPage() {
  const [items, setItems] = useState<Scholarship[]>([]);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  async function load(term = query) {
    try {
      const result = await apiFetch<Results>(
        `/api/admin/scholarships?q=${encodeURIComponent(term)}`,
      );
      setItems(result.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load scholarships.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    apiFetch<Results>("/api/admin/scholarships?q=")
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load scholarships.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  function updateItem(id: string, change: Partial<Scholarship>) {
    setItems((current) =>
      current.map((item) =>
        item.scholarship_id === id ? { ...item, ...change } : item,
      ),
    );
  }
  async function save(item: Scholarship) {
    setBusyId(item.scholarship_id);
    setError("");
    setNotice("");
    try {
      await apiFetch(
        `/api/admin/scholarships/${encodeURIComponent(item.scholarship_id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: item.title,
            host_country: item.host_country,
            application_url: item.application_url,
            is_active: item.is_active,
          }),
        },
      );
      setNotice(`Saved ${item.scholarship_id}.`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save scholarship.",
      );
    } finally {
      setBusyId(null);
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(
        `${API_URL}/api/admin/scholarships/import-csv`,
        { method: "POST", credentials: "include", body: form },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "CSV import failed.",
        );
      setNotice(
        `Imported ${result.import.inserted}; updated ${result.import.updated}; skipped ${result.import.skipped}.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not import this file.",
      );
    } finally {
      setUploadBusy(false);
      event.target.value = "";
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery);
    void load(draftQuery);
  }
  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">CATALOGUE MANAGEMENT</p>
          <h1>Scholarships</h1>
          <p>Edit core listing fields or re-import a CSV.</p>
        </div>
        <label className="admin-outline upload-label">
          <Upload size={15} />
          {uploadBusy ? "Importing..." : "Import CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={uploadBusy}
            onChange={upload}
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="action-message" role="status">
          {notice}
        </p>
      )}
      <form className="admin-search" onSubmit={search}>
        <Search size={16} />
        <input
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="Search title or university"
        />
        <button className="admin-outline">Search</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID / opportunity</th>
              <th>Host country</th>
              <th>Application URL</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.scholarship_id}>
                <td>
                  <strong>{item.title}</strong>
                  <small>
                    {item.university_name} · {item.level} ·{" "}
                    {item.scholarship_id}
                  </small>
                </td>
                <td>
                  <input
                    value={item.host_country || ""}
                    onChange={(event) =>
                      updateItem(item.scholarship_id, {
                        host_country: event.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={item.application_url || ""}
                    placeholder="Search fallback used"
                    onChange={(event) =>
                      updateItem(item.scholarship_id, {
                        application_url: event.target.value || null,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={(event) =>
                      updateItem(item.scholarship_id, {
                        is_active: event.target.checked,
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    className="admin-save"
                    disabled={busyId === item.scholarship_id}
                    onClick={() => save(item)}
                  >
                    {busyId === item.scholarship_id ? "Saving" : "Save"}
                    <ArrowRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-table-foot">Showing up to 50 matches per query.</p>
    </div>
  );
}
