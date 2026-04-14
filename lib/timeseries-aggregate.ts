/** Timeseries row shape from `GET /analytics/transactions/timeseries`. */
export type TimeseriesApiItem = {
  bucket_start: string;
  tpv?: string | number;
  transaction_count?: string | number;
  vs_previous_tpv_pct?: string | number | null;
  vs_previous_tpv_trend?: string;
};

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function int(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function sumTimeseriesTpv(items: TimeseriesApiItem[]): number {
  return items.reduce((acc, row) => acc + num(row.tpv), 0);
}

export function sumTimeseriesTransactionCount(items: TimeseriesApiItem[]): number {
  return items.reduce((acc, row) => acc + int(row.transaction_count), 0);
}

/** Parse user-entered target (allows commas). */
export function parseTargetAmount(input: string): number | null {
  const t = input.trim().replace(/,/g, "");
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function parseTargetCount(input: string): number | null {
  const t = input.trim().replace(/,/g, "");
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}
