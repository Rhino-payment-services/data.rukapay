import * as d3 from "d3";

/** Compact Y labels for currency / large counts (avoids duplicate tick text). */
export function formatYAxisCompact(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(abs % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 0)}k`;
  return d3.format(",.0f")(n);
}

/** Pick a readable date tick format from the visible time span. */
export function timeTickFormatForSpan(start: Date, end: Date): (d: Date | d3.NumberValue) => string {
  const spanDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
  if (spanDays <= 10) return (d) => d3.timeFormat("%a %d")(d as Date);
  if (spanDays <= 120) return (d) => d3.timeFormat("%b %d")(d as Date);
  if (spanDays <= 400) return (d) => d3.timeFormat("%b '%y")(d as Date);
  return (d) => d3.timeFormat("%b '%y")(d as Date);
}
