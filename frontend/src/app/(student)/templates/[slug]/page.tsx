"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ArrowLeft,
  Bold,
  Download,
  Heading2,
  Italic,
  List,
  RotateCcw,
  Save,
  Undo2,
  Redo2,
} from "lucide-react";
import { API_URL, apiFetch } from "@/lib/api";

type Field = {
  key: string;
  label: string;
  type: "text" | "textarea";
  required: boolean;
  hint?: string;
};
type Template = {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  body_html: string;
  fields_json: Field[];
  tips: string[];
  recommended_word_range: number[];
};
type UserDocument = {
  id: number;
  title: string;
  template_id: number | null;
  scholarship_id: string | null;
  content_html: string;
  placeholders_json: Record<string, string>;
  version: number;
};

export default function TemplateEditorPage() {
  const params = useParams<{ slug: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [documentId, setDocumentId] = useState<number | null>(null);
  const loadedDocumentId = useRef<string | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<{ version: number }[]>([]);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Your draft begins here..." }),
    ],
    content: "<p>Loading your template...</p>",
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  useEffect(() => {
    apiFetch<Template>(`/api/templates/${encodeURIComponent(params.slug)}`)
      .then((loaded) => {
        setTemplate(loaded);
        setTitle(loaded.title);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load template.",
        ),
      );
  }, [params.slug]);
  useEffect(() => {
    if (!template || !editor) return;
    const requestedId = new URLSearchParams(window.location.search).get(
      "document_id",
    );
    if (!requestedId || loadedDocumentId.current === requestedId) return;
    loadedDocumentId.current = requestedId;
    apiFetch<UserDocument>(`/api/documents/${requestedId}`)
      .then((document) => {
        if (document.template_id !== template.id) {
          throw new Error("This document belongs to another template.");
        }
        setDocumentId(document.id);
        setTitle(document.title);
        setAnswers(document.placeholders_json);
        setSavedContent(document.content_html);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not reopen this document.",
        ),
      );
  }, [template, editor]);
  const previewHTML = useMemo(() => {
    if (!template) return "";
    if (savedContent) return savedContent;
    return template.body_html.replace(
      /\{\{([a-zA-Z0-9_]+)\}\}/g,
      (match, key: string) =>
        escapeHtml(answers[key] || `[${key.replaceAll("_", " ")}]`),
    );
  }, [template, answers, savedContent]);
  useEffect(() => {
    if (editor && previewHTML) editor.commands.setContent(previewHTML);
  }, [editor, previewHTML]);
  useEffect(() => {
    if (!documentId || !editor) return;
    const timer = window.setInterval(() => {
      void apiFetch(`/api/documents/${documentId}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          content_html: editor.getHTML(),
          placeholders_json: answers,
        }),
      })
        .then(() => setMessage("Draft autosaved."))
        .catch(() => setError("Autosave failed. Use Save document to retry."));
    }, 20000);
    return () => window.clearInterval(timer);
  }, [documentId, editor, title, answers]);
  const wordCount =
    editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0;

  async function save(event?: FormEvent, asNew = false) {
    event?.preventDefault();
    if (!template || !editor || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const content_html = editor.getHTML();
    try {
      if (documentId && !asNew) {
        const updated = await apiFetch<UserDocument>(
          `/api/documents/${documentId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              title,
              content_html,
              placeholders_json: answers,
            }),
          },
        );
        setVersions((current) => [{ version: updated.version }, ...current]);
      } else {
        const created = await apiFetch<UserDocument>("/api/documents", {
          method: "POST",
          body: JSON.stringify({
            title,
            template_id: template.id,
            doc_type: template.category,
            content_html,
            placeholders_json: answers,
          }),
        });
        setDocumentId(created.id);
        setVersions([{ version: created.version }]);
      }
      setMessage("Saved to My Documents.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadVersions() {
    if (!documentId) return;
    try {
      setVersions(
        await apiFetch<{ version: number }[]>(
          `/api/documents/${documentId}/versions`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load versions.",
      );
    }
  }

  async function restore(version: number) {
    if (!documentId) return;
    try {
      const restored = await apiFetch<UserDocument>(
        `/api/documents/${documentId}/restore/${version}`,
        { method: "POST" },
      );
      setSavedContent(restored.content_html);
      editor?.commands.setContent(restored.content_html);
      setAnswers(restored.placeholders_json);
      setMessage(`Restored version ${version}.`);
      await loadVersions();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this version.",
      );
    }
  }

  if (error && !template)
    return (
      <div className="empty-state">
        <strong>Template unavailable</strong>
        <span>{error}</span>
        <Link className="text-link" href="/templates">
          Back to templates <ArrowLeft size={14} />
        </Link>
      </div>
    );
  if (!template) return <div className="loading-line">Loading template...</div>;

  return (
    <div className="page-stack document-editor-page">
      <Link className="text-link" href="/templates">
        <ArrowLeft size={14} /> All templates
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {template.category.toUpperCase()} · WORKSPACE
          </p>
          <h1>{template.title}</h1>
          <p className="page-subtitle">{template.description}</p>
        </div>
        <label className="document-title">
          Document name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      </section>
      <div className="editor-toolbar">
        <button
          title="Bold"
          aria-label="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </button>
        <button
          title="Italic"
          aria-label="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </button>
        <button
          title="Heading"
          aria-label="Heading"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={17} />
        </button>
        <button
          title="Bullet list"
          aria-label="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          title="Undo"
          aria-label="Undo"
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Redo"
          aria-label="Redo"
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
        <span className="editor-word-count">
          {wordCount} words
          {template.recommended_word_range?.[1]
            ? ` · ${template.recommended_word_range[0]}–${template.recommended_word_range[1]} suggested`
            : ""}
        </span>
      </div>
      <div className="document-workspace">
        <aside className="document-form">
          <div className="document-panel-head">
            <strong>Your notes</strong>
            <button className="text-link" onClick={() => setAnswers({})}>
              <RotateCcw size={13} /> Clear
            </button>
          </div>
          {template.fields_json.map((field) => (
            <label className="wizard-label" key={field.key}>
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  required={field.required}
                  value={answers[field.key] || ""}
                  onChange={(event) => {
                    setSavedContent(null);
                    setAnswers((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                  }}
                  placeholder={field.hint || "Add your notes"}
                />
              ) : (
                <input
                  required={field.required}
                  value={answers[field.key] || ""}
                  onChange={(event) => {
                    setSavedContent(null);
                    setAnswers((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                  }}
                  placeholder={field.hint || "Your answer"}
                />
              )}
            </label>
          ))}
          <div className="document-tips">
            <strong>Keep in mind</strong>
            {template.tips.map((tip) => (
              <p key={tip}>{tip}</p>
            ))}
          </div>
        </aside>
        <section className="document-canvas">
          <EditorContent editor={editor} />
        </section>
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
      <div className="document-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => save()}
        >
          <Save size={15} />
          {busy ? "Saving..." : "Save document"}
        </button>
        <button
          className="outline-button"
          disabled={busy}
          onClick={() => save(undefined, true)}
        >
          Save as new
        </button>
        {documentId && (
          <>
            <button className="outline-button" onClick={loadVersions}>
              Versions ({versions.length || "view"})
            </button>
            <a
              className="outline-button"
              href={`${API_URL}/api/documents/${documentId}/export?format=docx`}
            >
              <Download size={14} /> Export DOCX
            </a>
            <a
              className="outline-button"
              href={`${API_URL}/api/documents/${documentId}/export?format=pdf`}
            >
              Export PDF
            </a>
            <a
              className="outline-button"
              href={`${API_URL}/api/documents/${documentId}/export?format=txt`}
            >
              Export TXT
            </a>
          </>
        )}
      </div>
      {versions.length > 0 && (
        <div className="version-strip">
          {versions.map((item) => (
            <button
              key={item.version}
              className="text-link"
              onClick={() => restore(item.version)}
            >
              Restore v{item.version}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
