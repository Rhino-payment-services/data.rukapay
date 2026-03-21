/** Read HSL component vars (format: "h s% l%") from :root / .dark. */
export function hslVar(name: string): string {
  if (typeof window === "undefined") {
    return "hsl(0 0% 50%)";
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "hsl(0 0% 50%)";
  return `hsl(${raw})`;
}

/** Ordinal colors for bars / series (cycles chart-1 … chart-8). */
export function chartColors(): string[] {
  const keys = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6", "--chart-7", "--chart-8"];
  if (typeof window === "undefined") {
    return ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#dc2626", "#db2777", "#0d9488"];
  }
  return keys.map((k) => hslVar(k));
}
