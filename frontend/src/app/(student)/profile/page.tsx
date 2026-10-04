"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ProfileData = {
  user: { full_name: string; email: string; plan: string };
  profile: {
    origin_country?: string;
    target_level?: string;
    funding_preference?: string;
  } | null;
};

export default function ProfilePage() {
  const [form, setForm] = useState({
    full_name: "",
    origin_country: "Pakistan",
    target_level: "",
    funding_preference: "any",
  });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<ProfileData>("/api/users/me")
      .then((data) => {
        setEmail(data.user.email);
        setForm((current) => ({
          ...current,
          full_name: data.user.full_name,
          ...(data.profile || {}),
        }));
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load profile.",
        ),
      );
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Profile saved.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR DETAILS, YOURS TO CHANGE</p>
          <h1>Profile & preferences.</h1>
          <p className="page-subtitle">Keep your study plans up to date.</p>
        </div>
        <span className="plan-chip">Free plan</span>
      </section>
      <form className="profile-form" onSubmit={save}>
        <div className="profile-section-title">
          <UserRound size={18} />
          <div>
            <strong>Personal details</strong>
            <span>Basic account information</span>
          </div>
        </div>
        <label className="wizard-label">
          Full name
          <input
            required
            minLength={1}
            value={form.full_name}
            onChange={(event) =>
              setForm({ ...form, full_name: event.target.value })
            }
          />
        </label>
        <label className="wizard-label">
          Email address
          <input value={email} disabled />
        </label>
        <div className="profile-section-title">
          <span className="profile-section-mark">02</span>
          <div>
            <strong>Study preferences</strong>
            <span>Used to shape scholarship matches</span>
          </div>
        </div>
        <label className="wizard-label">
          Origin country
          <input
            value={form.origin_country || ""}
            onChange={(event) =>
              setForm({ ...form, origin_country: event.target.value })
            }
          />
        </label>
        <label className="wizard-label">
          Target degree
          <select
            value={form.target_level || ""}
            onChange={(event) =>
              setForm({ ...form, target_level: event.target.value })
            }
          >
            <option value="">Choose a degree</option>
            <option value="Undergraduate">Bachelor&apos;s (Undergraduate)</option>
            <option value="Master">Master&apos;s</option>
            <option value="PhD">PhD</option>
          </select>
        </label>
        <label className="wizard-label">
          Funding preference
          <select
            value={form.funding_preference || "any"}
            onChange={(event) =>
              setForm({ ...form, funding_preference: event.target.value })
            }
          >
            <option value="any">Any</option>
            <option value="full_tuition">Full tuition waiver</option>
            <option value="partial">Partial funding</option>
            <option value="with_stipend">Monthly stipend</option>
          </select>
          <span className="input-hint">
            This preference does not filter matched results.
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="action-message" role="status">
            <Check size={14} /> {message}
          </p>
        )}
        <div className="wizard-actions">
          <Link className="outline-button" href="/onboarding">
            Edit all preferences
          </Link>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
