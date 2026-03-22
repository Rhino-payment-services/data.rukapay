/**
 * Client-side fetch helper for `/api/analytics/*` — parses JSON errors from the proxy or FastAPI.
 */
export async function fetchAnalyticsJson<T>(path: string, search: URLSearchParams): Promise<T> {
  const res = await fetch(`/api/analytics/${path}?${search.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.trim() || res.statusText;
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      if (typeof j.detail === "string") {
        message = j.detail;
      } else if (Array.isArray(j.detail)) {
        message = j.detail
          .map((d) =>
            typeof d === "object" && d !== null && "msg" in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d)
          )
          .join("; ");
      } else if (j.detail != null) {
        message = JSON.stringify(j.detail);
      } else if (typeof j.error === "string") {
        message = j.error;
      } else if (typeof j.message === "string") {
        message = j.message;
      }
    } catch {
      // keep raw text (e.g. HTML error page snippet)
    }
    if (message.length > 400) message = `${message.slice(0, 400)}…`;
    throw new Error(`${res.status}: ${message}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from analytics API");
  }
}
