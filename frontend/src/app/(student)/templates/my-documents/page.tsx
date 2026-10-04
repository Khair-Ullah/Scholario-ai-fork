"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, FileText, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type DocumentRow = {
  id: number;
  title: string;
  template_slug: string | null;
  doc_type: string | null;
  status: string;
  word_count: number;
  updated_at: string;
};

export default function MyDocumentsPage() {
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    apiFetch<DocumentRow[]>("/api/documents")
      .then(setItems)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load documents.",
        ),
      );
  }, []);

  async function duplicate(id: number) {
    try {
      const copy = await apiFetch<DocumentRow>(
        `/api/documents/${id}/duplicate`,
        { method: "POST" },
      );
      setItems((current) => [copy, ...current]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not duplicate document.",
      );
    }
  }
  async function remove(id: number) {
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete document.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORDS, KEPT SAFE</p>
          <h1>My documents.</h1>
          <p className="page-subtitle">
            {items.length} drafts and finished documents.
          </p>
        </div>
        <Link className="outline-button" href="/templates">
          Browse templates <ArrowRight size={14} />
        </Link>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {items.length ? (
        <div className="match-list">
          {items.map((item) => (
            <div className="match-row saved-row" key={item.id}>
              <span className="match-symbol">
                <FileText size={16} color="#26736b" />
              </span>
              <Link
                className="match-main"
                href={item.template_slug ? `/templates/${item.template_slug}?document_id=${item.id}` : "/templates"}
              >
                <strong>{item.title}</strong>
                <small>
                  {item.doc_type || "Document"} · {item.word_count} words ·
                  Updated {new Date(item.updated_at).toLocaleDateString()}
                </small>
              </Link>
              <span className="status-pill">{item.status}</span>
              <button
                className="icon-action small-action"
                aria-label="Duplicate document"
                onClick={() => duplicate(item.id)}
              >
                <Copy size={14} />
              </button>
              <button
                className="icon-action small-action"
                aria-label="Delete document"
                onClick={() => remove(item.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={23} />
          <strong>Your writing space is ready.</strong>
          <span>
            Start with a template and your draft will stay private to your
            account.
          </span>
          <Link className="text-link" href="/templates">
            Browse templates <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
