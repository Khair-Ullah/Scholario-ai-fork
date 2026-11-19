const BASE = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expires: number }>();

/**
 * Server-side fetch for public marketing data. Always returns `fallback` when the
 * API is unreachable so the landing page still builds and renders during CI or
 * when the backend is restarting. Successful responses are cached in-process for
 * 30 seconds so the landing page stays fast under repeated requests.
 */
export async function fetchPublic<T>(path: string, fallback: T): Promise<T> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now) return hit.value as T;

  try {
    const response = await fetch(`${BASE}${path}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as T;
    cache.set(path, { value: data, expires: now + CACHE_TTL_MS });
    return data;
  } catch {
    return fallback;
  }
}
