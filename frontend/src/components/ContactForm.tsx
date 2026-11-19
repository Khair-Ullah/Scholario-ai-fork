"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";

const TOPICS = [
  "Account or sign-in",
  "Onboarding or matching",
  "Billing or refunds",
  "Scholarship listing",
  "Privacy or account deletion",
  "Something else",
];

const SUPPORT_EMAIL = "support@scholario.ai";
const MAX_MESSAGE = 2000;

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: TOPICS[0],
    message: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const mailto = useMemo(() => {
    const subject = `[${form.topic}] Support request${form.name ? ` — ${form.name}` : ""}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Topic: ${form.topic}`,
      "",
      form.message,
    ].join("\n");
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [form]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.message.trim().length < 20) {
      setError("Please add a little more detail so we can help (at least 20 characters).");
      return;
    }
    setBusy(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          topic: form.topic,
          message: form.message.trim(),
        }),
      });
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We couldn't reach the server just now. Please try again, or email us directly.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    const firstName = form.name.trim().split(/\s+/)[0] || "there";
    return (
      <div className="contact-card contact-success" role="status">
        <span className="contact-success-icon">
          <CheckCircle2 size={26} />
        </span>
        <h2>Message sent</h2>
        <p>
          Thanks, {firstName}. Your note is with the team and we&apos;ll reply to{" "}
          <strong>{form.email}</strong> within 2–5 business days.
        </p>
        <div className="contact-success-actions">
          <button
            type="button"
            className="contact-secondary"
            onClick={() => {
              setSent(false);
              setForm({ name: "", email: "", topic: TOPICS[0], message: "" });
            }}
          >
            Send another message
          </button>
          <Link className="contact-text-link" href="/">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-card">
      <div className="contact-card-head">
        <p className="eyebrow">SEND A MESSAGE</p>
        <h2>Tell us what you need</h2>
        <p>We read every message. A little detail now saves a round trip later.</p>
      </div>

      <form onSubmit={submit} className="contact-form">
        <div className="contact-row">
          <label className="contact-field">
            <span>Your name</span>
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Ayesha Khan"
            />
          </label>
          <label className="contact-field">
            <span>Email address</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>
        </div>

        <label className="contact-field">
          <span>What is this about?</span>
          <select
            value={form.topic}
            onChange={(event) => setForm({ ...form, topic: event.target.value })}
          >
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </label>

        <label className="contact-field">
          <span className="contact-label-row">
            Message
            <span className="contact-counter">
              {form.message.length}/{MAX_MESSAGE}
            </span>
          </span>
          <textarea
            required
            minLength={20}
            maxLength={MAX_MESSAGE}
            rows={6}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder="Tell us what you were doing, what happened, and what you expected."
          />
        </label>

        {error && (
          <p className="contact-error" role="alert">
            {error}
          </p>
        )}

        <div className="contact-form-foot">
          <p className="contact-consent">
            We use your details only to reply. Read our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
          <button className="contact-submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="contact-spin" size={16} /> Sending...
              </>
            ) : (
              <>
                Send message <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="contact-alt">
        Prefer email? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      {error && (
        <p className="contact-mailto">
          If the form keeps failing,{" "}
          <a href={mailto}>open this message in your email app</a>.
        </p>
      )}
    </div>
  );
}
