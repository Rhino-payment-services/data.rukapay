const STORAGE_KEY = "data.rukapay.execAnalytics.txTargets.v1";

export type StoredTxTargets = {
  tpv: string;
  transactionCount: string;
};

export function loadTxTargets(): StoredTxTargets {
  if (typeof window === "undefined") return { tpv: "", transactionCount: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tpv: "", transactionCount: "" };
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { tpv: "", transactionCount: "" };
    const o = j as Record<string, unknown>;
    return {
      tpv: typeof o.tpv === "string" ? o.tpv : "",
      transactionCount: typeof o.transactionCount === "string" ? o.transactionCount : "",
    };
  } catch {
    return { tpv: "", transactionCount: "" };
  }
}

export function saveTxTargets(targets: StoredTxTargets): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // ignore quota / private mode
  }
}
