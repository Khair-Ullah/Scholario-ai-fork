"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Download,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type AdminScholarship, type ImportReport } from "@/admin/api";

const PAGE_SIZE = 50;
const LEVELS = ["Bachelor", "Master", "PhD", "Diploma", "Language"];
const TYPES = ["government", "university", "foundation", "private", ""];

export default function AdminScholarshipsPage() {
  const [rows, setRows] = useState<AdminScholarship[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminScholarship | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; ids: string[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportReport | null>(null);

  async function load(nextPage = page, term = query, lvl = level) {
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const result = await adminApi.listScholarships({
        q: term,
        page: nextPage,
        page_size: PAGE_SIZE,
        level: lvl,
      });
      setRows(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load scholarships.");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
    let active = true;
    adminApi
      .listScholarships({ q: "", page: 1, page_size: PAGE_SIZE, level: "" })
      .then((result) => {
        if (active) {
          setRows(result.items);
          setTotal(result.total ?? 0);
          setPage(result.page);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load scholarships.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const checkedAll = rows.length > 0 && rows.every((row) => selected.has(row.scholarship_id));
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (checkedAll) rows.forEach((row) => next.delete(row.scholarship_id));
      else rows.forEach((row) => next.add(row.scholarship_id));
      return next;
    });
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: string, ids: string[]) {
    setBusy(action);
    setError("");
    try {
      const result = await adminApi.bulkScholarships(ids, action as "activate" | "deactivate" | "delete");
      setToast(
        action === "delete"
          ? `Deleted ${result.deleted} scholarships.`
          : `Updated ${result.affected.length} scholarships (${action}).`,
      );
      setSelected(new Set());
      await load(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk action failed.");
    } finally {
      setBusy("");
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, dryRun: boolean) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(dryRun ? "preview" : "import");
    setError("");
    try {
      const result = await adminApi.uploadScholarshipsCsv(file, dryRun);
      if (dryRun) setPreview(result.import);
      else {
        setToast(
          `Imported ${result.import.inserted}; updated ${result.import.updated}; skipped ${result.import.skipped}.`,
        );
        await load(1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process this file.");
    } finally {
      setBusy("");
      event.target.value = "";
    }
  }

  async function exportCsv() {
    try {
      const csv = await adminApi.exportScholarshipsCsv({ q: query });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "scholarships.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    }
  }

  const columns: Column<AdminScholarship>[] = useMemo(
    () => [
      {
        key: "select",
        label: "",
        header: "admin-th-check",
        render: (row) => (
          <input
            type="checkbox"
            checked={selected.has(row.scholarship_id)}
            onChange={() => toggle(row.scholarship_id)}
          />
        ),
      },
      {
        key: "title",
        label: "ID / Opportunity",
        render: (row) => (
          <>
            <strong>{row.title}</strong>
            <small>
              {row.university_name ?? "—"} · {(row.level ?? "any").toUpperCase()} · {row.scholarship_id}
            </small>
          </>
        ),
      },
      {
        key: "country",
        label: "Host",
        render: (row) => row.host_country ?? "—",
      },
      {
        key: "deadline",
        label: "Deadline",
        render: (row) =>
          row.deadline_date
            ? new Date(row.deadline_date).toLocaleDateString()
            : row.deadline_kind === "unspecified" || !row.deadline_kind
              ? "—"
              : row.deadline_kind,
      },
      {
        key: "type",
        label: "Type",
        render: (row) => row.scholarship_type ?? "—",
      },
      {
        key: "active",
        label: "Status",
        render: (row) => (
          <button
            className={row.is_active ? "admin-chip-active" : "admin-chip-inactive"}
            onClick={() => setEditing(row)}
          >
            {row.is_active ? "Active" : "Inactive"}
          </button>
        ),
      },
      {
        key: "actions",
        label: "",
        header: "admin-th-end",
        render: (row) => (
          <button className="admin-outline" onClick={() => setEditing(row)}>
            Edit
          </button>
        ),
      },
    ],
    [selected],
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CATALOGUE MANAGEMENT"
        title="Scholarships"
        description="Edit core listing fields or re-import a CSV."
        actions={
          <>
            <button className="admin-outline" onClick={exportCsv}>
              <Download size={15} /> Export CSV
            </button>
            <label className="admin-outline upload-label">
              <Upload size={15} /> {busy === "preview" ? "Previewing..." : "Preview CSV"}
              <input type="file" accept=".csv,text/csv" disabled={busy !== ""} onChange={(e) => upload(e, true)} />
            </label>
            <label className="admin-outline upload-label">
              <Upload size={15} /> {busy === "import" ? "Importing..." : "Import CSV"}
              <input type="file" accept=".csv,text/csv" disabled={busy !== ""} onChange={(e) => upload(e, false)} />
            </label>
            <button className="admin-btn primary" onClick={() => setEditing("new")}>
              <Plus size={15} /> New listing
            </button>
          </>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />

      <div className="admin-filter-bar">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draft);
            void load(1, draft, level);
          }}
        >
          <Search size={16} />
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search title or university" />
          <button className="admin-outline">Search</button>
        </form>
        <label>
          Level
          <select value={level} onChange={(event) => {
            setLevel(event.target.value);
            void load(1, query, event.target.value);
          }}>
            <option value="">All</option>
            {LEVELS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        {selected.size > 0 && (
          <div className="admin-bulk-actions">
            <button className="admin-chip-active" onClick={() => setConfirm({ action: "activate", ids: [...selected] })}>
              Activate
            </button>
            <button className="admin-chip-inactive" onClick={() => setConfirm({ action: "deactivate", ids: [...selected] })}>
              Deactivate
            </button>
            <button className="admin-btn danger" onClick={() => setConfirm({ action: "delete", ids: [...selected] })}>
              <Trash2 size={14} /> Delete ({selected.size})
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="No scholarships match this query."
        getRowKey={(row) => row.scholarship_id}
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} listings · page {page} of {pages}
            </span>
            <span>
              <button disabled={page <= 1} onClick={() => void load(page - 1)}>
                Previous
              </button>
              <button disabled={page >= pages} onClick={() => void load(page + 1)}>
                Next
              </button>
            </span>
          </div>
        }
      />

      {preview && (
        <section className="admin-box">
          <h3>CSV preview (dry run)</h3>
          <p>
            {preview.rows_read} rows read · would insert {preview.would_insert} · would update {preview.would_update}
            {" "}· unknown countries {preview.unknown_country} · warnings {preview.warnings}
          </p>
          {preview.errors.length > 0 && (
            <ul className="admin-error-list">
              {preview.errors.slice(0, 10).map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Title</th>
                  <th>University</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{String(row.title ?? "")}</td>
                    <td>{String(row.university_name ?? "")}</td>
                    <td>{String(row.host_country ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="admin-outline" onClick={() => setPreview(null)}>
            Close preview
          </button>
        </section>
      )}

      <Drawer open={editing !== null} title={editing === "new" ? "New scholarship" : `Edit ${editing?.scholarship_id ?? ""}`} onClose={() => setEditing(null)}>
        <ScholarshipForm
          initial={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            void load(1);
          }}
          onError={setError}
        />
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "delete" ? "Delete scholarships" : `Mark ${confirm?.action}?`}
        message={
          confirm?.action === "delete"
            ? `This permanently deletes ${confirm?.ids.length} scholarships. This cannot be undone.`
            : `Set ${confirm?.ids.length} scholarships to ${confirm?.action}?`
        }
        danger={confirm?.action === "delete"}
        confirmLabel={confirm?.action === "delete" ? "Delete" : "Confirm"}
        busy={busy !== ""}
        onConfirm={() => {
          if (confirm) void runBulk(confirm.action, confirm.ids);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function ScholarshipForm({
  initial,
  onSaved,
  onError,
}: {
  initial: AdminScholarship | null;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState({
    scholarship_id: initial?.scholarship_id ?? "",
    title: initial?.title ?? "",
    university_name: initial?.university_name ?? "",
    host_country: initial?.host_country ?? "",
    application_url: initial?.application_url ?? "",
    level: initial?.level ?? "",
    scholarship_type: initial?.scholarship_type ?? "",
    ielts_required: initial?.ielts_required ?? false,
    ielts_band: initial?.ielts_band ?? "",
    deadline_kind: initial?.deadline_kind ?? "unspecified",
    deadline_date: initial?.deadline_date ?? "",
    is_active: initial?.is_active ?? true,
    description_text: initial?.description_text ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      const body = {
        ...draft,
        application_url: draft.application_url || null,
        deadline_date: draft.deadline_date || null,
        description_text: draft.description_text || null,
      };
      if (initial) await adminApi.updateScholarship(initial.scholarship_id, body);
      else await adminApi.createScholarship(body);
      onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save scholarship.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof draft, value: string | boolean | null) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={submit}>
      <label>
        ID (slug)
        {initial ? (
          <span className="admin-thumb">{initial.scholarship_id}</span>
        ) : (
          <input required value={draft.scholarship_id} onChange={(e) => set("scholarship_id", e.target.value)} />
        )}
      </label>
      <label>
        Title
        <input required value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label>
        University / provider
        <input value={draft.university_name} onChange={(e) => set("university_name", e.target.value)} />
      </label>
      <label>
        Host country
        <input value={draft.host_country} onChange={(e) => set("host_country", e.target.value)} />
      </label>
      <label>
        Application URL
        <input value={draft.application_url} onChange={(e) => set("application_url", e.target.value)} />
      </label>
      <label>
        Level
        <select value={draft.level} onChange={(e) => set("level", e.target.value)}>
          <option value="">Any</option>
          {LEVELS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select value={draft.scholarship_type} onChange={(e) => set("scholarship_type", e.target.value)}>
          {TYPES.map((option) => (
            <option value={option} key={option || "any"}>
              {option === "" ? "Unspecified" : option}
            </option>
          ))}
        </select>
      </label>
      <label>
        Deadline kind
        <select value={draft.deadline_kind} onChange={(e) => set("deadline_kind", e.target.value)}>
          <option value="unspecified">Unspecified</option>
          <option value="rolling">Rolling</option>
          <option value="fixed">Fixed</option>
        </select>
      </label>
      <label>
        Deadline date
        <input type="date" value={draft.deadline_date} onChange={(e) => set("deadline_date", e.target.value)} />
      </label>
      <label>
        IELTS required
        <span className="admin-thumb">
          <input type="checkbox" checked={draft.ielts_required} onChange={(e) => set("ielts_required", e.target.checked)} />
        </span>
      </label>
      <label>
        IELTS band (e.g. 6.5)
        <input value={draft.ielts_band} onChange={(e) => set("ielts_band", e.target.value)} />
      </label>
      <label>
        Description
        <textarea value={draft.description_text} onChange={(e) => set("description_text", e.target.value)} />
      </label>
      <label>
        Active
        <span className="admin-thumb">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        </span>
      </label>
      <div className="admin-drawer-foot">
        <button className="admin-btn primary" disabled={saving}>
          {saving ? "Saving..." : initial ? "Save changes" : "Create listing"}
        </button>
      </div>
    </form>
  );
}