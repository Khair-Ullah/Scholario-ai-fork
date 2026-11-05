"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Search, ShieldCheck, Trash } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { consultantApi, type ConsultantScholarship as Scholarship } from "@/consultant/api";

const PAGE_SIZE = 50;

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

export default function ConsultantScholarshipsPage() {
  const [rows, setRows] = useState<Scholarship[]>([]);
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

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setEditorOpen(true);
  }

  function openEdit(item: Scholarship) {
    setEditing(item);
    setDraft(toDraft(item));
    setEditorOpen(true);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...draft,
        deadline_date: draft.deadline_date || null,
        ielts_band: draft.ielts_band || null,
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
      setError(cause instanceof Error ? cause.message : "Could not save scholarship.");
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
    try {
      await consultantApi.deleteScholarship(deleteTarget.scholarship_id);
      setToast("Scholarship deleted.");
      setDeleteTarget(null);
      await load(page, query);
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
    { key: "university", label: "University", render: (item) => item.university_name || "—" },
    {
      key: "deadline",
      label: "Deadline",
      render: (item) =>
        item.deadline_date ? new Date(item.deadline_date).toLocaleDateString() : item.deadline_kind || "—",
    },
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
        <button className="admin-outline" onClick={() => setDeleteTarget(item)}>
          <Trash size={13} /> Delete
        </button>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CATALOGUE"
        title="My scholarships"
        description={`${total.toLocaleString()} scholarships you provide.`}
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
          <input value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)} placeholder="Search your scholarships" />
          <button className="admin-outline">Search</button>
        </form>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="You have not created any scholarships yet."
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
        title={editing ? editing.title : "New scholarship"}
        onClose={() => setEditorOpen(false)}
        width={560}
      >
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            Scholarship ID
            <input
              required
              disabled={Boolean(editing)}
              value={draft.scholarship_id}
              onChange={(event) => setDraft({ ...draft, scholarship_id: event.target.value })}
            />
          </label>
          <label>
            Title
            <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            University
            <input
              value={draft.university_name}
              onChange={(event) => setDraft({ ...draft, university_name: event.target.value })}
            />
          </label>
          <label>
            Host country
            <input
              value={draft.host_country}
              onChange={(event) => setDraft({ ...draft, host_country: event.target.value })}
            />
          </label>
          <label>
            Level
            <input value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} />
          </label>
          <label>
            Funding / type
            <input
              value={draft.scholarship_type}
              onChange={(event) => setDraft({ ...draft, scholarship_type: event.target.value })}
            />
          </label>
          <label>
            Deadline kind
            <select
              value={draft.deadline_kind}
              onChange={(event) => setDraft({ ...draft, deadline_kind: event.target.value })}
            >
              <option value="unspecified">Unspecified</option>
              <option value="fixed">Fixed date</option>
              <option value="rolling">Rolling</option>
              <option value="anytime">Anytime</option>
            </select>
          </label>
          <label>
            Deadline date
            <input
              type="date"
              value={draft.deadline_date}
              onChange={(event) => setDraft({ ...draft, deadline_date: event.target.value })}
            />
          </label>
          <label>
            Application URL
            <input
              value={draft.application_url}
              onChange={(event) => setDraft({ ...draft, application_url: event.target.value })}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={draft.ielts_required}
              onChange={(event) => setDraft({ ...draft, ielts_required: event.target.checked })}
            />
            IELTS required
          </label>
          {draft.ielts_required && (
            <label>
              IELTS band
              <input value={draft.ielts_band} onChange={(event) => setDraft({ ...draft, ielts_band: event.target.value })} />
            </label>
          )}
          <label>
            Description
            <textarea
              rows={5}
              value={draft.description_text}
              onChange={(event) => setDraft({ ...draft, description_text: event.target.value })}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
            />
            Visible to students
          </label>
          <button className="admin-btn primary" disabled={busy}>
            {busy ? "Saving..." : editing ? "Save changes" : "Create scholarship"}
          </button>
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
