export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

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

const AUTH_ERROR_CODES = new Set([
  "AUTH_REQUIRED",
  "AUTH_REVOKED",
  "AUTH_INVALID",
  "AUTH_INACTIVE",
  "AUTH_FORBIDDEN",
  "REFRESH_INVALID",
  "REFRESH_REUSED",
]);

export function isAuthError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  return error.status === 403 && !!error.code && AUTH_ERROR_CODES.has(error.code);
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

let refreshRequest: Promise<number> | null = null;

function refreshSession(): Promise<number> {
  if (!refreshRequest) {
    // Assign synchronously so concurrent 401s share one refresh call instead of
    // racing and tripping the backend's refresh-token reuse detection.
    refreshRequest = (async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: await csrfHeaders(),
        });
        return response.status;
      } catch {
        return 0;
      } finally {
        refreshRequest = null;
      }
    })();
  }
  return refreshRequest;
}

export type SessionUser = { id: number; email: string; full_name: string; role: string };

let meCache: Promise<SessionUser> | null = null;

export function resetSessionCache(): void {
  meCache = null;
}

export function getMe(force = false): Promise<SessionUser> {
  if (force || !meCache) {
    meCache = apiFetch<SessionUser>("/api/auth/me").catch((error) => {
      meCache = null;
      throw error;
    });
  }
  return meCache;
}

const SESSION_EXPIRED_KEY = "scholario.session-expired";
let endingSession = false;

function clearClientSessionCookies(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CSRF_COOKIE}=; Max-Age=0; path=/`;
}

async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // best effort — cookies may already be gone or the API unreachable
  }
  clearClientSessionCookies();
}

export async function signOut(loginPath = "/login"): Promise<void> {
  if (typeof window === "undefined") return;
  resetSessionCache();
  sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  await logoutRequest();
  window.location.assign(loginPath);
}

async function endSession(): Promise<void> {
  if (typeof window === "undefined" || endingSession) return;
  endingSession = true;
  resetSessionCache();
  await logoutRequest();
  const path = window.location.pathname;
  const onConsultant = path.startsWith("/consultant");
  const onAdmin = path.startsWith("/admin");
  const login = onConsultant ? "/consultant/login" : onAdmin ? "/admin/login" : "/login";
  const next = path + window.location.search;
  const onAuthPage = ["/login", "/register", "/admin/login", "/consultant/login"].some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
  const target =
    login === "/login" && next && next !== "/" && !onAuthPage
      ? `${login}?next=${encodeURIComponent(next)}`
      : login;
  // Only redirect once per session-expiry: if cookies could not be cleared the
  // middleware would bounce us straight back and we would loop forever.
  if (path !== login && !sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
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
    if (retry) {
      const refreshStatus = await refreshSession();
      if (refreshStatus === 200) return apiFetch<T>(path, init, false);
      if (refreshStatus !== 401 && refreshStatus !== 403) {
        throw new ApiError("The service is temporarily unavailable. Please try again.", refreshStatus || 503);
      }
    }
    await endSession();
  }
  if (response.status === 403 && retry && (await redirectOnRoleMismatch(response, path))) {
    throw new ApiError(
      "Your session is signed in as a different account. Please sign in again.",
      403,
      "AUTH_FORBIDDEN",
    );
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

async function redirectOnRoleMismatch(response: Response, requestPath: string): Promise<boolean> {
  if (typeof window === "undefined" || requestPath.startsWith("/api/auth/")) return false;
  const body = (await response.clone().json().catch(() => ({}))) as { code?: string };
  if (body.code !== "AUTH_FORBIDDEN") return false;

  const pagePath = window.location.pathname;
  if (pagePath === "/admin/login" || pagePath === "/consultant/login") return false;
  const requiredRole = pagePath.startsWith("/admin")
    ? "super_admin"
    : pagePath.startsWith("/consultant")
      ? "consultant"
      : null;
  if (!requiredRole) return false;

  try {
    const meResponse = await fetch(`${API_URL}/api/auth/me`, { credentials: "include", cache: "no-store" });
    if (!meResponse.ok) return false;
    const me = (await meResponse.json().catch(() => null)) as { role?: string } | null;
    if (!me?.role || me.role === requiredRole) return false;

    resetSessionCache();
    window.location.assign(requiredRole === "super_admin" ? "/admin/login" : "/consultant/login");
    return true;
  } catch {
    return false;
  }
}

async function ensureCsrfTokenForce(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/csrf`, { credentials: "include", cache: "no-store" });
  } catch {
    // ignore — retry will surface the error if it persists
  }
}
