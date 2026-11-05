import { apiFetch, API_URL, csrfHeaders } from "@/lib/api";

export type Paginated<T> = {
  items: T[];
  total?: number;
  page: number;
  page_size: number;
};

export type AdminStats = {
  users: number;
  new_today: number;
  new_7d: number;
  pro_users: number;
  scholarships: number;
  active_scholarships: number;
  saved: number;
  applications: number;
  documents: number;
  ai_messages_7d: number;
  signups_by_day: { date: string; count: number }[];
  top_saved: { scholarship_id: string; title: string; saves: number }[];
  latest_users: { id: number; email: string; full_name: string; created_at: string }[];
};

export type AdminScholarship = {
  scholarship_id: string;
  owner_id?: number | null;
  title: string;
  university_name?: string | null;
  host_country?: string | null;
  application_url?: string | null;
  level?: string | null;
  scholarship_type?: string | null;
  is_active?: boolean;
  ielts_required?: boolean | null;
  ielts_band?: string | null;
  ielts_tier?: number | null;
  deadline_date?: string | null;
  deadline_kind?: string | null;
  fields_list?: string[];
  description_text?: string | null;
  source_data?: Record<string, unknown>;
};

export type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified?: boolean;
  plan: string;
  created_at: string;
  plan_expires_at?: string | null;
  last_login?: string | null;
  last_login_at?: string | null;
  profile?: Record<string, unknown> | null;
  stats?: Record<string, number | string | null>;
  sessions?: AdminSession[];
};

export type AdminSession = {
  id: number;
  created_at?: string | null;
  expires_at?: string | null;
  user_agent?: string | null;
  ip?: string | null;
  revoked: boolean;
};

export type AdminTemplate = {
  id: number;
  slug: string;
  title: string;
  category: string;
  description?: string | null;
  body_html?: string | null;
  fields_json?: { key?: string; label?: string; placeholder?: string; type?: string }[];
  recommended_word_range?: number[];
  tips?: string[];
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
};

export type DataQualityQueue = "unmapped" | "missing_deadline" | "missing_url" | "ielts_missing_band";

export type DataQualityResponse = {
  queue: DataQualityQueue;
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<DataQualityQueue, number>;
};

export type AuditEntry = {
  id: number;
  actor_id?: number | null;
  actor_email?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  diff?: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null } | null;
  ip?: string | null;
  created_at?: string | null;
};

export type PaymentsSummary = {
  plan_counts: { free: number; pro: number };
  disabled: number;
  pro_expiring_soon: number;
  history: { id: number; action: string; actor_email?: string | null; created_at?: string | null; diff?: unknown }[];
  note: string;
};

export type PlatformSettings = {
  ai_provider: string;
  flags: Record<string, boolean>;
  limits: Record<string, number>;
};

export type Announcement = {
  id: number;
  title?: string;
  body?: string;
  audience?: string;
  link?: string | null;
  delivered?: number;
  actor_email?: string | null;
  created_at?: string | null;
};

export type AiStats = {
  sessions: number;
  messages_7d: number;
  tokens_total: number;
  by_provider: Record<string, number>;
  recent_sessions: {
    id: number;
    user_email?: string | null;
    title: string;
    messages: number;
    created_at?: string | null;
  }[];
};

export type AdminConsultant = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  plan: string;
  totp_enabled: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
  scholarships: number;
  open_warnings: number;
};

export type ConsultantWarning = {
  id: number;
  consultant_id: number;
  consultant_email?: string | null;
  issued_by_email?: string | null;
  severity: "info" | "warning" | "critical";
  category: string;
  reason: string;
  detail?: string | null;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  created_at?: string | null;
};

export type ImportReport = {
  rows_read: number;
  inserted: number;
  updated: number;
  skipped: number;
  unknown_country: number;
  warnings: number;
  errors: string[];
  preview: Record<string, unknown>[];
  would_insert: number;
  would_update: number;
  dry_run: boolean;
};

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const adminApi = {
  stats: () => apiFetch<AdminStats>("/api/admin/stats"),

  listScholarships: (params: {
    q?: string;
    page?: number;
    page_size?: number;
    level?: string;
    host_country?: string;
    is_active?: boolean;
    scholarship_type?: string;
    sort?: string;
    order?: string;
  }) => apiFetch<Paginated<AdminScholarship>>(`/api/admin/scholarships${qs(params)}`),

  createScholarship: (body: Partial<AdminScholarship> & { scholarship_id: string; title: string }) =>
    apiFetch<AdminScholarship>("/api/admin/scholarships", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateScholarship: (id: string, body: Partial<AdminScholarship>) =>
    apiFetch<AdminScholarship>(`/api/admin/scholarships/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteScholarship: (id: string) =>
    apiFetch<{ deleted: string }>(`/api/admin/scholarships/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  bulkScholarships: (ids: string[], action: "activate" | "deactivate" | "delete") =>
    apiFetch<{ action: string; updated: number; deleted: number; affected: string[]; missing: string[] }>(
      "/api/admin/scholarships/bulk",
      { method: "POST", body: JSON.stringify({ ids, action }) },
    ),

  exportScholarshipsCsv: async (params: Record<string, string | number | boolean | undefined> = {}) => {
    const response = await fetch(`${API_URL}/api/admin/scholarships/export-csv${qs(params)}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Export failed");
    return response.text();
  },

  uploadScholarshipsCsv: async (file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", file);
    const path = dryRun ? "/api/admin/scholarships/import-csv/dry-run" : "/api/admin/scholarships/import-csv";
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: await csrfHeaders(),
      body: form,
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof body.detail === "string" ? body.detail : "Import failed.";
      throw new Error(message);
    }
    return body as { country_map?: unknown; import: ImportReport };
  },

  dataQuality: (queue: DataQualityQueue, page = 1, pageSize = 50) =>
    apiFetch<DataQualityResponse>(`/api/admin/data-quality${qs({ queue, page, page_size: pageSize })}`),

  updateUniversityCountry: (name: string, host_country: string, confidence = 1) =>
    apiFetch<{ host_country: string }>(
      `/api/admin/universities/${encodeURIComponent(name)}/country`,
      { method: "PATCH", body: JSON.stringify({ host_country, confidence }) },
    ),

  listUsers: (params: { q?: string; page?: number; page_size?: number; role?: string; plan?: string; is_active?: boolean }) =>
    apiFetch<Paginated<AdminUser> & { counts: { total: number; pro: number; disabled: number; admins: number } }>(
      `/api/admin/users${qs(params)}`,
    ),

  getUser: (id: number) => apiFetch<AdminUser>(`/api/admin/users/${id}`),

  updateUser: (id: number, body: Partial<AdminUser>) =>
    apiFetch<AdminUser>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getUserSessions: (id: number) => apiFetch<AdminSession[]>(`/api/admin/users/${id}/sessions`),

  getUserOnboarding: (id: number) =>
    apiFetch<{ profile: Record<string, unknown> | null }>(`/api/admin/users/${id}/onboarding`),

  revokeSessions: (id: number) =>
    apiFetch<{ revoked: number }>(`/api/admin/users/${id}/revoke-sessions`, { method: "POST" }),

  resetOnboarding: (id: number) =>
    apiFetch<{ onboarding_step: number; onboarding_completed: boolean }>(
      `/api/admin/users/${id}/reset-onboarding`,
      { method: "POST" },
    ),

  listTemplates: (params: { category?: string; q?: string } = {}) =>
    apiFetch<AdminTemplate[]>(`/api/admin/templates${qs(params)}`),

  createTemplate: (body: Partial<AdminTemplate> & { slug: string; title: string; category: string }) =>
    apiFetch<AdminTemplate>("/api/admin/templates", { method: "POST", body: JSON.stringify(body) }),

  getTemplate: (id: number) => apiFetch<AdminTemplate>(`/api/admin/templates/${id}`),

  updateTemplate: (id: number, body: Partial<AdminTemplate>) =>
    apiFetch<AdminTemplate>(`/api/admin/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteTemplate: (id: number) =>
    apiFetch<{ deleted: number }>(`/api/admin/templates/${id}`, { method: "DELETE" }),

  reorderTemplate: (id: number, sort_order: number) =>
    apiFetch<{ id: number; sort_order: number }>(`/api/admin/templates/${id}/reorder`, {
      method: "POST",
      body: JSON.stringify({ sort_order }),
    }),

  sendAnnouncement: (body: { title: string; body: string; audience: "all" | "pro" | "free"; link?: string }) =>
    apiFetch<{ delivered: number; audience: string }>("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listAnnouncements: (page = 1, pageSize = 20) =>
    apiFetch<Paginated<Announcement>>(`/api/admin/announcements${qs({ page, page_size: pageSize })}`),

  payments: () => apiFetch<PaymentsSummary>("/api/admin/payments"),

  grantPlan: (body: { user_id: number; plan: "free" | "pro"; expires_at?: string | null; note?: string }) =>
    apiFetch<{ user_id: number; plan: string }>("/api/admin/payments/grant", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  approveTransfer: (body: { reference: string; user_id?: number; note?: string; approve: boolean }) =>
    apiFetch<{ reference: string; approved: boolean }>("/api/admin/payments/transfer", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSettings: () => apiFetch<PlatformSettings>("/api/admin/settings"),

  updateSettings: (body: Partial<Pick<PlatformSettings, "ai_provider" | "flags" | "limits">>) =>
    apiFetch<PlatformSettings>("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),

  listAudit: (params: { actor?: string; action?: string; entity?: string; page?: number; page_size?: number }) =>
    apiFetch<Paginated<AuditEntry>>(`/api/admin/audit${qs(params)}`),

  aiStats: () => apiFetch<AiStats>("/api/admin/ai-stats"),

  listConsultants: (params: { q?: string; page?: number; page_size?: number; is_active?: boolean } = {}) =>
    apiFetch<Paginated<AdminConsultant>>(`/api/admin/consultants${qs(params)}`),

  createConsultant: (body: { email: string; password: string; full_name: string }) =>
    apiFetch<AdminConsultant>("/api/admin/consultants", { method: "POST", body: JSON.stringify(body) }),

  updateConsultant: (id: number, body: { is_active?: boolean; full_name?: string; plan?: string }) =>
    apiFetch<AdminConsultant>(`/api/admin/consultants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  warnConsultant: (id: number, body: { severity: "info" | "warning" | "critical"; reason: string; detail?: string }) =>
    apiFetch<ConsultantWarning>(`/api/admin/consultants/${id}/warn`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetConsultant2fa: (id: number) =>
    apiFetch<{ id: number; totp_enabled: boolean }>(`/api/admin/consultants/${id}/reset-2fa`, { method: "POST" }),

  listWarnings: (params: { consultant_id?: number; severity?: string; is_acknowledged?: boolean; page?: number; page_size?: number } = {}) =>
    apiFetch<Paginated<ConsultantWarning>>(`/api/admin/warnings${qs(params)}`),
};
