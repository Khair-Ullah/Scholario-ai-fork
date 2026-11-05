"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { MfaPanel } from "@/admin/components/MfaPanel";
import { consultantApi, type ConsultantProfile } from "@/consultant/api";

export default function ConsultantProfilePage() {
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    consultantApi
      .getProfile()
      .then((loaded) => {
        if (!active) return;
        setProfile(loaded);
        setFullName(loaded.full_name);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load profile.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await consultantApi.updateProfile({ full_name: fullName });
      setToast("Profile updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader eyebrow="ACCOUNT" title="Profile & security" description="Manage your consultant account details and sign-in security." />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />

      <section className="admin-box">
        <h3>Account details</h3>
        <div className="admin-form">
          <label>
            Email
            <input value={profile?.email ?? ""} disabled readOnly />
          </label>
          <form onSubmit={save}>
            <label>
              Full name
              <input required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <button className="admin-btn primary" disabled={busy || !profile}>
              {busy ? "Saving..." : "Save changes"}
            </button>
          </form>
          {profile?.last_login_at && (
            <p className="admin-thumb">Last sign-in {new Date(profile.last_login_at).toLocaleString()}</p>
          )}
        </div>
      </section>

      <MfaPanel />
    </div>
  );
}
