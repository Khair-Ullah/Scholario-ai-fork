export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CSRF_COOKIE = "csrftoken";
const CSRF_HEADER = "X-CSRF-Token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function ensureCsrfToken(): Promise<string | undefined> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  try {
    const response = await fetch(`${API_URL}/api/auth/csrf`, { credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (typeof body.token === "string") return body.token;
  } catch {
    // fall through to cookie read
  }
  return readCookie(CSRF_COOKIE);
}

export async function csrfHeaders(): Promise<Record<string, string>> {
  const token = await ensureCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}

let refreshRequest: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: await csrfHeaders(),
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

const SESSION_EXPIRED_KEY = "scholario.session-expired";
let endingSession = false;

async function endSession(): Promise<void> {
  if (typeof window === "undefined" || endingSession) return;
  endingSession = true;
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // best effort — cookies may already be gone or the API unreachable
  }
  const onAdmin = window.location.pathname.startsWith("/admin");
  const login = onAdmin ? "/admin/login" : "/login";
  const next = window.location.pathname + window.location.search;
  const target =
    !onAdmin && next && next !== "/" && !next.startsWith("/login") && !next.startsWith("/register")
      ? `${login}?next=${encodeURIComponent(next)}`
      : login;
  // Only redirect once per session-expiry: if cookies could not be cleared the
  // middleware would bounce us straight back and we would loop forever.
  if (window.location.pathname !== login && !sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
    window.location.assign(target);
  }
  endingSession = false;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (UNSAFE_METHODS.has(method) && !headers.has(CSRF_HEADER)) {
    const token = await ensureCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    if (retry && (await refreshSession())) return apiFetch<T>(path, init, false);
    await endSession();
  }
  if (response.status === 403 && retry && (await readCsrfFailure(response))) {
    await ensureCsrfTokenForce();
    return apiFetch<T>(path, init, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string" ? body.detail : "The request could not be completed.";
    throw new ApiError(message, response.status, body.code);
  }
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return body as T;
}

async function readCsrfFailure(response: Response): Promise<boolean> {
  const body = await response.clone().json().catch(() => ({}));
  return body.code === "CSRF_FAILED";
}

async function ensureCsrfTokenForce(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/csrf`, { credentials: "include", cache: "no-store" });
  } catch {
    // ignore — retry will surface the error if it persists
  }
}
