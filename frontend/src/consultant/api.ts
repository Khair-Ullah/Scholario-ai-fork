import type { AdminScholarship, ConsultantWarning, Paginated } from "@/admin/api";
import { API_URL, apiFetch } from "@/lib/api";

export type { AdminScholarship as ConsultantScholarship, ConsultantWarning, Paginated };

export type ConsultantStats = {
  scholarships: number;
  active_scholarships: number;
  applicants: number;
  saves: number;
  applications: number;
  open_warnings: number;
};

export type ConsultantApplicant = {
  id: number;
  email: string;
  full_name: string;
  plan: string;
  created_at?: string | null;
  origin_country?: string | null;
  target_level?: string | null;
  host_countries?: string[] | null;
  fields_of_study?: string[] | null;
  saves: number;
  applications: number;
};

export type ConsultantApplicantDetail = {
  id: number;
  email: string;
  full_name: string;
  plan: string;
  created_at?: string | null;
  profile?: Record<string, unknown> | null;
  saved: { scholarship_id: string; title: string }[];
  applications: { scholarship_id: string; title: string; status: string }[];
};

export type ConsultantProfile = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  totp_enabled: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
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

export const consultantApi = {
  stats: () => apiFetch<ConsultantStats>("/api/consultant/stats"),

  listScholarships: (params: {
    q?: string;
    page?: number;
    page_size?: number;
    level?: string;
    host_country?: string;
    is_active?: boolean;
    sort?: string;
    order?: string;
  }) => apiFetch<Paginated<AdminScholarship>>(`/api/consultant/scholarships${qs(params)}`),

  createScholarship: (body: Partial<AdminScholarship> & { scholarship_id: string; title: string }) =>
    apiFetch<AdminScholarship>("/api/consultant/scholarships", { method: "POST", body: JSON.stringify(body) }),

  getScholarship: (id: string) =>
    apiFetch<AdminScholarship>(`/api/consultant/scholarships/${encodeURIComponent(id)}`),

  updateScholarship: (id: string, body: Partial<AdminScholarship>) =>
    apiFetch<AdminScholarship>(`/api/consultant/scholarships/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteScholarship: (id: string) =>
    apiFetch<{ deleted: string }>(`/api/consultant/scholarships/${encodeURIComponent(id)}`, { method: "DELETE" }),

  bulkScholarships: (ids: string[], action: "activate" | "deactivate" | "delete") =>
    apiFetch<{ action: string; updated: number; deleted: number; affected: string[]; missing: string[] }>(
      "/api/consultant/scholarships/bulk",
      { method: "POST", body: JSON.stringify({ ids, action }) },
    ),

  exportScholarshipsCsv: async () => {
    const response = await fetch(`${API_URL}/api/consultant/scholarships/export-csv`, { credentials: "include" });
    if (!response.ok) throw new Error("Export failed");
    return response.text();
  },

  listApplicants: (params: { q?: string; page?: number; page_size?: number } = {}) =>
    apiFetch<Paginated<ConsultantApplicant>>(`/api/consultant/applicants${qs(params)}`),

  getApplicant: (id: number) => apiFetch<ConsultantApplicantDetail>(`/api/consultant/applicants/${id}`),

  listWarnings: (includeAcknowledged = true) =>
    apiFetch<ConsultantWarning[]>(`/api/consultant/warnings${qs({ include_acknowledged: includeAcknowledged })}`),

  acknowledgeWarning: (id: number) =>
    apiFetch<{ id: number; is_acknowledged: boolean }>(`/api/consultant/warnings/${id}/ack`, { method: "POST" }),

  getProfile: () => apiFetch<ConsultantProfile>("/api/consultant/profile"),

  updateProfile: (body: { full_name?: string }) =>
    apiFetch<{ id: number; full_name: string }>("/api/consultant/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  sendAnnouncement: (body: { title: string; body: string; audience: "all" | "pro" | "free"; link?: string }) =>
    apiFetch<{ delivered: number }>("/api/consultant/announcements", { method: "POST", body: JSON.stringify(body) }),
};
