"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { Toast } from "@/admin/components/Toast";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { adminApi, type AdminTemplate } from "@/admin/api";

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<AdminTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminTemplate | null>(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await adminApi.listTemplates());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    adminApi
      .listTemplates()
      .then((loaded) => {
        if (active) setItems(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load templates.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function move(item: AdminTemplate, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const target = sorted[index + direction];
    if (!target) return;
    try {
      await adminApi.reorderTemplate(item.id, target.sort_order);
      await adminApi.reorderTemplate(target.id, item.sort_order);
      setToast("Order updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reorder.");
    }
  }

  async function remove() {
    if (!deleting || removing) return;
    setError("");
    setRemoving(true);
    try {
      await adminApi.deleteTemplate(deleting.id);
      setToast(`Deleted ${deleting.title}.`);
      setDeleting(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete template.");
    } finally {
      setRemoving(false);
    }
  }

  const columns: Column<AdminTemplate>[] = [
    {
      key: "title",
      label: "Template",
      render: (item) => (
        <>
          <strong>{item.title}</strong>
          <small>/{item.slug} · {item.category}</small>
        </>
      ),
    },
    {
      key: "premium",
      label: "Access",
      render: (item) => (
        <span className={item.is_premium ? "admin-pill gold" : "admin-pill"}>{item.is_premium ? "Premium" : "Free"}</span>
      ),
    },
    {
      key: "words",
      label: "Target words",
      render: (item) => (
        <span className="admin-thumb">
          {item.recommended_word_range?.[0] ?? "—"}–{item.recommended_word_range?.[1] ?? "—"}
        </span>
      ),
    },
    {
      key: "order",
      label: "Order",
      render: (item) => (
        <span className="admin-order-btns">
          <button onClick={() => void move(item, -1)} disabled={item.sort_order === Math.min(...items.map((row) => row.sort_order))}>
            ↑
          </button>
          <button onClick={() => void move(item, 1)} disabled={item.sort_order === Math.max(...items.map((row) => row.sort_order))}>
            ↓
          </button>
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      header: "admin-th-end",
      render: (item) => (
        <span className="admin-row-actions">
          <button className="admin-outline" onClick={() => setEditing(item)}>
            <Pencil size={13} /> Edit
          </button>
          <button className="admin-btn danger" onClick={() => setDeleting(item)}>
            <Trash2 size={13} />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CONTENT SYSTEMS"
        title="Templates"
        description="SOP and document templates used in the student editor."
        actions={
          <button className="admin-btn primary" onClick={() => setEditing("new")}>
            <Plus size={15} /> New template
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />
      <DataTable columns={columns} rows={items} loading={loading} emptyText="No templates yet." />

      <Drawer open={editing !== null} title={editing === "new" ? "New template" : `Edit ${editing?.slug ?? ""}`} onClose={() => setEditing(null)} width={560}>
        <TemplateForm
          initial={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onError={setError}
        />
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete template"
        message={`Delete "${deleting?.title ?? ""}"? This fails if a user document still references it.`}
        confirmLabel="Delete"
        danger
        busy={removing}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function TemplateForm({
  initial,
  onSaved,
  onError,
}: {
  initial: AdminTemplate | null;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState({
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    category: initial?.category ?? "sop",
    description: initial?.description ?? "",
    body_html: initial?.body_html ?? "",
    is_premium: initial?.is_premium ?? false,
    is_active: initial?.is_active ?? true,
    min: initial?.recommended_word_range?.[0] ?? 250,
    max: initial?.recommended_word_range?.[1] ?? 800,
    tips: (initial?.tips ?? []).join("\n"),
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof draft, value: string | number | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      const body = {
        slug: draft.slug,
        title: draft.title,
        category: draft.category,
        description: draft.description || null,
        body_html: draft.body_html || null,
        is_premium: draft.is_premium,
        is_active: draft.is_active,
        recommended_word_range: [draft.min, draft.max],
        tips: draft.tips.split("\n").map((tip) => tip.trim()).filter(Boolean),
      };
      if (initial) await adminApi.updateTemplate(initial.id, body);
      else await adminApi.createTemplate(body as Parameters<typeof adminApi.createTemplate>[0]);
      onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Title
        <input required value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label>
        Slug
        {initial ? (
          <span className="admin-thumb">{draft.slug}</span>
        ) : (
          <input required value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="my-sop-template" />
        )}
      </label>
      <label>
        Category
        <select value={draft.category} onChange={(e) => set("category", e.target.value)}>
          <option value="sop">Statement of purpose</option>
          <option value="motivation">Motivation letter</option>
          <option value="essay">Essay</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Description
        <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label>
        Target word range (min–max)
        <span className="admin-range">
          <input type="number" min={50} value={draft.min} onChange={(e) => set("min", Number(e.target.value))} />
          <input type="number" min={50} value={draft.max} onChange={(e) => set("max", Number(e.target.value))} />
        </span>
      </label>
      <label>
        Tips (one per line)
        <textarea value={draft.tips} onChange={(e) => set("tips", e.target.value)} />
      </label>
      <label>
        Premium only
        <span className="admin-thumb">
          <input type="checkbox" checked={draft.is_premium} onChange={(e) => set("is_premium", e.target.checked)} />
        </span>
      </label>
      <label>
        Active
        <span className="admin-thumb">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        </span>
      </label>
      <div className="admin-drawer-foot">
        <button className="admin-btn primary" disabled={saving}>
          {saving ? "Saving..." : initial ? "Save changes" : "Create template"}
        </button>
      </div>
    </form>
  );
}