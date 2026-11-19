"use client";

import { useEffect, useState } from "react";
import {
  BadgePlus,
  CalendarDays,
  Download,
  ExternalLink,
  Eye,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash,
} from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { consultantApi, type ConsultantScholarship as Scholarship } from "@/consultant/api";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 50;
const LEVELS = ["Bachelor", "Master", "PhD", "Diploma", "Language"];
const TYPES = [
  { value: "", label: "Unspecified" },
  { value: "government", label: "Government" },
  { value: "university", label: "University" },
  { value: "foundation", label: "Foundation" },
  { value: "private", label: "Private" },
];

type Draft = {
  scholarship_id: string;
  title: string;
  university_name: string;
  host_country: string;
  level: string;
  scholarship_type: string;
  deadline_kind: string;
  deadline_date: string;
  application_url: string;
  description_text: string;
  ielts_required: boolean;
  ielts_band: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  scholarship_id: "",
  title: "",
  university_name: "",
  host_country: "",
  level: "",
  scholarship_type: "",
  deadline_kind: "unspecified",
  deadline_date: "",
  application_url: "",
  description_text: "",
  ielts_required: false,
  ielts_band: "",
  is_active: true,
};

function toDraft(item: Scholarship): Draft {
  return {
    scholarship_id: item.scholarship_id,
    title: item.title,
    university_name: item.university_name ?? "",
    host_country: item.host_country ?? "",
    level: item.level ?? "",
    scholarship_type: item.scholarship_type ?? "",
    deadline_kind: item.deadline_kind ?? "unspecified",
    deadline_date: item.deadline_date ?? "",
    application_url: item.application_url ?? "",
    description_text: item.description_text ?? "",
    ielts_required: Boolean(item.ielts_required),
    ielts_band: item.ielts_band ?? "",
    is_active: item.is_active ?? true,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function deadlineLabel(item: Scholarship) {
  if (item.deadline_date) {
    const parsed = new Date(`${item.deadline_date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
  }
  if (item.deadline_kind === "rolling") return "Rolling";
  if (item.deadline_kind === "anytime") return "Anytime";
  if (item.deadline_kind === "unspecified") return "Not specified";
  return item.deadline_kind || "Not specified";
}

export default function ConsultantScholarshipsPage() {
  const [rows, setRows] = useState<Scholarship[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Scholarship | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Scholarship | null>(null);

  async function load(nextPage = page, term = query) {
    setLoading(true);
    setError("");
    try {
      const result = await consultantApi.listScholarships({ q: term, page: nextPage, page_size: PAGE_SIZE });
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
    consultantApi
      .listScholarships({ page: 1, page_size: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotal(result.total ?? 0);
        setPage(result.page);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load scholarships.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<string[]>("/api/meta/countries")
      .then((items) => {
        if (!active) return;
        setCountries(items.filter((country) => country !== "Antarctica").sort());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft });
    setIdTouched(false);
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(item: Scholarship) {
    setEditing(item);
    setDraft(toDraft(item));
    setIdTouched(true);
    setFormError("");
    setEditorOpen(true);
  }

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setFormError("");
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(value: string) {
    setDraft((current) => ({
      ...current,
      title: value,
      scholarship_id: editing || idTouched ? current.scholarship_id : slugify(value),
    }));
  }

  function generateId() {
    const next = slugify(draft.title);
    if (!next) return;
    update("scholarship_id", next);
    setIdTouched(true);
  }

  function updateDeadlineKind(value: string) {
    setDraft((current) => ({
      ...current,
      deadline_kind: value,
      deadline_date: value === "fixed" ? current.deadline_date : "",
    }));
  }

  function updateIelts(required: boolean) {
    setDraft((current) => ({
      ...current,
      ielts_required: required,
      ielts_band: required ? current.ielts_band : "",
    }));
  }

  async function save() {
    if (!draft.title.trim()) {
      setFormError("Add a scholarship title before saving.");
      return;
    }
    if (!draft.scholarship_id.trim()) {
      setFormError("Add a scholarship ID before saving.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        ...draft,
        scholarship_id: draft.scholarship_id.trim(),
        title: draft.title.trim(),
        university_name: draft.university_name.trim() || null,
        host_country: draft.host_country.trim() || null,
        level: draft.level || null,
        scholarship_type: draft.scholarship_type || null,
        deadline_date: draft.deadline_kind === "fixed" ? draft.deadline_date || null : null,
        application_url: draft.application_url.trim() || null,
        description_text: draft.description_text.trim() || null,
        ielts_band: draft.ielts_required ? draft.ielts_band.trim() || null : null,
      };
      if (editing) {
        await consultantApi.updateScholarship(editing.scholarship_id, payload);
        setToast("Scholarship updated.");
      } else {
        await consultantApi.createScholarship(payload);
        setToast("Scholarship created.");
      }
      setEditorOpen(false);
      await load(editing ? page : 1, query);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not save scholarship.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: Scholarship) {
    setError("");
    try {
      await consultantApi.updateScholarship(item.scholarship_id, { is_active: !item.is_active });
      setRows((current) =>
        current.map((row) => (row.scholarship_id === item.scholarship_id ? { ...row, is_active: !row.is_active } : row)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update scholarship.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      await consultantApi.deleteScholarship(deleteTarget.scholarship_id);
      setToast("Scholarship deleted.");
      setDeleteTarget(null);
      await load(page > 1 && rows.length === 1 ? page - 1 : page, query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete scholarship.");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const csv = await consultantApi.exportScholarshipsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-scholarships.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    }
  }

  const columns: Column<Scholarship>[] = [
    {
      key: "title",
      label: "Scholarship",
      render: (item) => (
        <>
          <button className="admin-link" onClick={() => openEdit(item)}>
            {item.title}
          </button>
          <small>{item.scholarship_id}</small>
        </>
      ),
    },
    {
      key: "university",
      label: "University",
      render: (item) => (
        <>
          <strong>{item.university_name || "Provider not set"}</strong>
          <small>{item.host_country || "Location not set"}</small>
        </>
      ),
    },
    {
      key: "level",
      label: "Level",
      render: (item) => (
        <>
          <strong>{item.level || "Any level"}</strong>
          <small>{item.scholarship_type || "Funding type not set"}</small>
        </>
      ),
    },
    { key: "deadline", label: "Deadline", render: (item) => deadlineLabel(item) },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <button
          className={item.is_active ? "admin-chip-active" : "admin-chip-inactive"}
          onClick={() => void toggleActive(item)}
        >
          <ShieldCheck size={13} /> {item.is_active ? "Active" : "Hidden"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item) => (
        <div className="consultant-row-actions">
          <button className="admin-outline" onClick={() => openEdit(item)}>
            <Pencil size={13} /> Edit
          </button>
          <button className="admin-outline" onClick={() => setDeleteTarget(item)}>
            <Trash size={13} /> Delete
          </button>
        </div>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previewUrl = /^https?:\/\//i.test(draft.application_url.trim()) ? draft.application_url.trim() : "";

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CATALOGUE"
        title="My scholarships"
        description={`${total.toLocaleString()} scholarships you provide. Keep deadlines and application links current so students can act with confidence.`}
        actions={
          <>
            <button className="admin-outline" onClick={() => void exportCsv()}>
              <Download size={15} /> Export CSV
            </button>
            <button className="admin-btn primary" onClick={openCreate}>
              <Plus size={15} /> New scholarship
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
            setQuery(draftQuery);
            void load(1, draftQuery);
          }}
        >
          <Search size={16} />
          <input
            aria-label="Search scholarships"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Search by title, university or ID"
          />
          <button type="submit" className="admin-outline">
            Search
          </button>
        </form>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="No scholarships yet. Use New scholarship to add your first listing."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} scholarships · page {page} of {pages}
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

      <Drawer
        open={editorOpen}
        title={editing ? "Edit scholarship" : "Add a scholarship"}
        onClose={closeEditor}
        width={720}
      >
        <form
          className="admin-form consultant-scholarship-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="cs-editor-intro">
            <span className="cs-editor-intro-icon">
              <BadgePlus size={20} />
            </span>
            <div>
              <span className="cs-editor-kicker">{editing ? "Editing listing" : "New listing"}</span>
              <strong>{editing ? "Keep this opportunity current." : "Create a clear, student-ready opportunity."}</strong>
              <p>
                {editing
                  ? "Update the details students rely on, then save your changes."
                  : "Add the essentials now. You can fine-tune the listing later from your catalogue."}
              </p>
            </div>
          </div>

          {formError && (
            <p className="cs-form-error" role="alert">
              {formError}
            </p>
          )}

          <section className="cs-editor-section">
            <header className="cs-editor-section-head">
              <span className="cs-section-step">01</span>
              <span className="cs-section-icon">
                <GraduationCap size={16} />
              </span>
              <div>
                <strong>Listing basics</strong>
                <small>Name the opportunity, provider and study level.</small>
              </div>
            </header>
            <div className="cs-editor-grid">
              <div className="cs-field cs-span-2">
                <label className="cs-field-label" htmlFor="cs-title">
                  Scholarship title <span className="cs-required">Required</span>
                </label>
                <input
                  id="cs-title"
                  required
                  maxLength={500}
                  value={draft.title}
                  onChange={(event) => updateTitle(event.target.value)}
                  placeholder="e.g. Global Futures Scholarship 2027"
                />
                <small className="cs-help">Use the name students will see in your catalogue.</small>
              </div>

              <div className="cs-field cs-span-2">
                <label className="cs-field-label" htmlFor="cs-id">
                  Scholarship ID <span className={editing ? "cs-locked" : "cs-required"}>{editing ? "Locked" : "Required"}</span>
                </label>
                <div className="cs-input-action">
                  <input
                    id="cs-id"
                    required
                    disabled={Boolean(editing)}
                    maxLength={80}
                    value={draft.scholarship_id}
                    onChange={(event) => {
                      update("scholarship_id", event.target.value);
                      setIdTouched(true);
                    }}
                    placeholder="global-futures-2027"
                  />
                  {!editing && (
                    <button
                      type="button"
                      className="cs-inline-btn"
                      onClick={generateId}
                      disabled={!draft.title.trim()}
                    >
                      <Sparkles size={13} /> Generate
                    </button>
                  )}
                </div>
                <small className="cs-help">
                  {editing
                    ? "The ID is fixed after creation so existing links keep working."
                    : "A unique, URL-safe ID. It follows the title until you edit it."}
                </small>
              </div>

              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-university">
                  University / provider
                </label>
                <input
                  id="cs-university"
                  maxLength={240}
                  value={draft.university_name}
                  onChange={(event) => update("university_name", event.target.value)}
                  placeholder="e.g. University of Toronto"
                />
              </div>

              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-country">
                  Host country
                </label>
                <input
                  id="cs-country"
                  list="consultant-host-countries"
                  maxLength={120}
                  value={draft.host_country}
                  onChange={(event) => update("host_country", event.target.value)}
                  placeholder="Start typing a country"
                />
                <datalist id="consultant-host-countries">
                  {countries.map((country) => (
                    <option key={country} value={country} />
                  ))}
                </datalist>
              </div>

              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-level">
                  Study level
                </label>
                <select id="cs-level" value={draft.level} onChange={(event) => update("level", event.target.value)}>
                  <option value="">Any level</option>
                  {LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-type">
                  Funding type
                </label>
                <select
                  id="cs-type"
                  value={draft.scholarship_type}
                  onChange={(event) => update("scholarship_type", event.target.value)}
                >
                  {TYPES.map((option) => (
                    <option key={option.value || "any"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="cs-editor-section">
            <header className="cs-editor-section-head">
              <span className="cs-section-step">02</span>
              <span className="cs-section-icon">
                <CalendarDays size={16} />
              </span>
              <div>
                <strong>Deadlines & eligibility</strong>
                <small>Help students understand when and how they can apply.</small>
              </div>
            </header>
            <div className="cs-editor-grid">
              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-deadline-kind">
                  Deadline type
                </label>
                <select
                  id="cs-deadline-kind"
                  value={draft.deadline_kind}
                  onChange={(event) => updateDeadlineKind(event.target.value)}
                >
                  <option value="unspecified">Not specified</option>
                  <option value="fixed">Fixed date</option>
                  <option value="rolling">Rolling</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>

              <div className="cs-field">
                <label className="cs-field-label" htmlFor="cs-deadline-date">
                  Application deadline
                </label>
                <input
                  id="cs-deadline-date"
                  type="date"
                  disabled={draft.deadline_kind !== "fixed"}
                  value={draft.deadline_date}
                  onChange={(event) => update("deadline_date", event.target.value)}
                />
                <small className="cs-help">
                  {draft.deadline_kind === "fixed"
                    ? "Shown as the closing date on your listing."
                    : "Choose a fixed deadline to add a date."}
                </small>
              </div>

              <label className="cs-toggle-card cs-span-2">
                <span className="cs-toggle-icon">
                  <GraduationCap size={16} />
                </span>
                <span className="cs-toggle-copy">
                  <strong>IELTS required</strong>
                  <small>Show an English test requirement on this opportunity.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.ielts_required}
                  onChange={(event) => updateIelts(event.target.checked)}
                />
                <span className="cs-switch" aria-hidden="true">
                  <span />
                </span>
              </label>

              {draft.ielts_required && (
                <div className="cs-field">
                  <label className="cs-field-label" htmlFor="cs-ielts-band">
                    Minimum IELTS band
                  </label>
                  <input
                    id="cs-ielts-band"
                    inputMode="decimal"
                    maxLength={20}
                    value={draft.ielts_band}
                    onChange={(event) => update("ielts_band", event.target.value)}
                    placeholder="e.g. 6.5"
                  />
                  <small className="cs-help">Leave blank if the provider sets the band later.</small>
                </div>
              )}
            </div>
          </section>

          <section className="cs-editor-section">
            <header className="cs-editor-section-head">
              <span className="cs-section-step">03</span>
              <span className="cs-section-icon">
                <ExternalLink size={16} />
              </span>
              <div>
                <strong>Application details</strong>
                <small>Give students the official link and useful context.</small>
              </div>
            </header>
            <div className="cs-editor-grid">
              <div className="cs-field cs-span-2">
                <label className="cs-field-label" htmlFor="cs-url">
                  Official application link
                </label>
                <div className="cs-input-action">
                  <input
                    id="cs-url"
                    type="url"
                    value={draft.application_url}
                    onChange={(event) => update("application_url", event.target.value)}
                    placeholder="https://..."
                  />
                  {previewUrl && (
                    <a className="cs-inline-btn" href={previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                </div>
                <small className="cs-help">Use the official page where students can apply or learn more.</small>
              </div>

              <div className="cs-field cs-span-2">
                <label className="cs-field-label" htmlFor="cs-description">
                  Description
                </label>
                <textarea
                  id="cs-description"
                  rows={7}
                  value={draft.description_text}
                  onChange={(event) => update("description_text", event.target.value)}
                  placeholder="Add eligibility, benefits, or what makes this opportunity a good fit."
                />
                <small className="cs-help cs-help-row">
                  <span>Give students enough context to decide whether to apply.</span>
                  <span>{draft.description_text.length} characters</span>
                </small>
              </div>

              <label className="cs-toggle-card cs-span-2">
                <span className="cs-toggle-icon">
                  <Eye size={16} />
                </span>
                <span className="cs-toggle-copy">
                  <strong>Visible to students</strong>
                  <small>Published listings can appear in student matches and recommendations.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) => update("is_active", event.target.checked)}
                />
                <span className="cs-switch" aria-hidden="true">
                  <span />
                </span>
              </label>
            </div>
          </section>

          <footer className="cs-editor-footer">
            <p>
              <ShieldCheck size={14} /> You can edit this listing later.
            </p>
            <div className="cs-editor-actions">
              <button type="button" className="admin-outline" onClick={closeEditor} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="admin-btn primary" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={14} className="cs-spin" /> Saving...
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Create scholarship"
                )}
              </button>
            </div>
          </footer>
        </form>
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete scholarship"
        message={`Delete "${deleteTarget?.title ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
