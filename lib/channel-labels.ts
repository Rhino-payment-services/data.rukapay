/**
 * Human-readable labels for `transactions.channel` (and similar) raw backend values.
 */
const ACRONYMS = new Set(["ussd", "api", "pos", "atm", "web"]);

export function formatChannelLabel(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "Unknown";

  const normalized = s.replace(/\s+/g, "_").toUpperCase();

  const known: Record<string, string> = {
    APP: "App",
    USSD: "USSD",
    WEB: "Web",
    API: "API",
    POS: "POS",
    MERCHANT_PORTAL: "Merchant portal",
    MERCHANTPORTAL: "Merchant portal",
    BACKOFFICE: "Back office",
    BACK_OFFICE: "Back office",
    UNKNOWN: "Unknown",
  };

  if (known[normalized]) return known[normalized];

  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => {
      const low = word.toLowerCase();
      if (ACRONYMS.has(low)) return low.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
