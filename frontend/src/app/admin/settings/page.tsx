"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Toast } from "@/admin/components/Toast";
import { adminApi } from "@/admin/api";

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [aiProvider, setAiProvider] = useState("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    adminApi
      .getSettings()
      .then((settings) => {
        if (!active) return;
        setFlags(settings.flags ?? {});
        setLimits(settings.limits ?? {});
        setAiProvider(settings.ai_provider);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setError("");
    try {
      await adminApi.updateSettings({ flags, limits, ai_provider: aiProvider });
      setToast("Settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="PLATFORM CONFIGURATION"
        title="Settings"
        description="Feature flags and plan limits. Changes take effect immediately."
        actions={
          <button className="admin-btn primary" onClick={() => void save()}>
            <Save size={15} /> Save settings
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Toast text={toast} onHide={() => setToast("")} />

      <section className="admin-box">
        <h3>Artificial intelligence</h3>
        <div className="admin-key-value">
          <span>Provider</span>
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
            <option value="mock">Mock (offline)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
      </section>

      <section className="admin-box">
        <h3>Feature flags</h3>
        <div className="admin-flag-list">
          <FlagRow label="New registrations" hint="Allow students to create accounts." checked={!!flags.registration_enabled} onChange={(v) => setFlags((cur) => ({ ...cur, registration_enabled: v }))} />
          <FlagRow label="AI advisor" hint="Enable AI chat, review and matching tools." checked={!!flags.ai_enabled} onChange={(v) => setFlags((cur) => ({ ...cur, ai_enabled: v }))} />
          <FlagRow label="Announcements" hint="Allow sending in-app announcements." checked={!!flags.announcements_enabled} onChange={(v) => setFlags((cur) => ({ ...cur, announcements_enabled: v }))} />
        </div>
      </section>

      <section className="admin-box">
        <h3>Plan limits</h3>
        <div className="admin-flag-list">
          <NumberRow label="Free matching results" value={limits.free_results} onChange={(v) => setLimits((cur) => ({ ...cur, free_results: v }))} />
          <NumberRow label="Pro matching results" value={limits.pro_results} onChange={(v) => setLimits((cur) => ({ ...cur, pro_results: v }))} />
          <NumberRow label="Free document bundles" value={limits.free_documents} onChange={(v) => setLimits((cur) => ({ ...cur, free_documents: v }))} />
        </div>
      </section>
    </div>
  );
}

function FlagRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="admin-flag-row">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <label className="admin-flag-row">
      <span>
        <strong>{label}</strong>
      </span>
      <input
        type="number"
        min={1}
        value={value ?? 30}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}