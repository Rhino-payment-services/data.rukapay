/** Strip `502: ` style prefixes so the message reads cleanly. */
export function parseAnalyticsErrorDetail(message: string): { code: string | null; detail: string } {
  const m = message.trim();
  const match = /^(\d{3}):\s*([\s\S]+)$/.exec(m);
  if (match) return { code: match[1], detail: match[2].trim() };
  return { code: null, detail: m };
}

export type FriendlyAnalyticsError = {
  title: string;
  body: string;
  technical: string | null;
};

/**
 * Turn raw fetch/API errors into copy suitable for executives — no HTML dumps in the main text.
 */
export function friendlyAnalyticsError(rawMessage: string): FriendlyAnalyticsError {
  const trimmed = rawMessage.trim();
  const { code, detail } = parseAnalyticsErrorDetail(trimmed);
  const d = detail || trimmed;

  const technical =
    code != null ? `${code}${d && d !== trimmed ? `: ${d}` : ""}`.slice(0, 500) : trimmed.slice(0, 500);

  const looksHtml = /<!DOCTYPE|<\s*html[\s>]/i.test(d);
  const lower = d.toLowerCase();

  if (looksHtml || (code === "502" && d.length < 40 && !lower.includes("analytics"))) {
    return {
      title: "Couldn’t load data",
      body: "The analytics service didn’t respond correctly. This is often temporary — try again in a moment. If it keeps happening, try a shorter date range or ask your team to check the analytics service and network.",
      technical,
    };
  }

  if (code === "401" || /unauthorized/i.test(d)) {
    return {
      title: "Session expired",
      body: "Please sign out and sign in again to reload your data.",
      technical: null,
    };
  }

  if (code === "504" || /timeout|timed out|upstream timeout/i.test(lower)) {
    return {
      title: "Request timed out",
      body: "Loading took too long. Try again, or choose a shorter date range so the report can finish faster.",
      technical,
    };
  }

  if (code === "502" || code === "503" || /unreachable|bad gateway|connection refused|econnrefused|network/i.test(lower)) {
    return {
      title: "Service temporarily unavailable",
      body: "We couldn’t reach the analytics service. Please try again shortly. If the problem continues, the service may need to be restarted or the connection checked.",
      technical,
    };
  }

  if (code === "500" || /internal server error/i.test(lower)) {
    return {
      title: "Something went wrong",
      body: "The server hit an error while loading this data. Try again; if it persists, share the details below with your technical team.",
      technical,
    };
  }

  if (/invalid json/i.test(lower)) {
    return {
      title: "Unexpected response",
      body: "We received an invalid response from the server. Try again, or contact support if this continues.",
      technical,
    };
  }

  const shortDetail = d.length > 220 ? `${d.slice(0, 220)}…` : d;
  return {
    title: "Couldn’t load data",
    body: shortDetail,
    technical: d.length > 220 ? technical : null,
  };
}
