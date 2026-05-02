"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Download, Loader2, Minus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChannelBarChart } from "@/components/charts/ChannelBarChart";
import { TimeseriesLineChart } from "@/components/charts/TimeseriesLineChart";
import { WalletGrowthLineChart, type WalletGrowthPoint } from "@/components/charts/WalletGrowthLineChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalyticsErrorAlert,
  MerchantsTableLoadingSkeleton,
  OverviewLoadingSkeleton,
  TransactionsLoadingSkeleton,
  UsersLoadingSkeleton,
  WalletChartLoadingSkeleton,
} from "@/components/dashboard/AnalyticsStates";
import { TransactionTargetsComparison } from "@/components/dashboard/TransactionTargetsComparison";
import { KpiCard, MetricAbbrev, SegmentMetricLine, ThAbbr } from "@/components/dashboard/MetricAbbrev";
import { fetchAnalyticsJson } from "@/lib/analytics-fetch";
import {
  parseTargetAmount,
  parseTargetCount,
  sumTimeseriesTransactionCount,
  sumTimeseriesTpv,
  type TimeseriesApiItem,
} from "@/lib/timeseries-aggregate";
import { loadTxTargets, saveTxTargets } from "@/lib/transaction-targets-storage";

/** All analytics requests use Kampala (EAT); matches data_service default. */
const EXEC_ANALYTICS_TIMEZONE = "Africa/Kampala" as const;

/** Auto-refresh visible tab data so KPIs and charts stay current without a manual reload. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

type AnyMetrics = Record<string, unknown>;
type WeeklyComparisonBundle = {
  thisWeekOverview: AnyMetrics;
  lastWeekOverview: AnyMetrics;
  thisWeekUsers: AnyMetrics;
  lastWeekUsers: AnyMetrics;
};

type WeeklyMetricCard = {
  id: string;
  label: string;
  thisWeek: number;
  lastWeek: number;
  unit: "money" | "count" | "percent";
  higherIsBetter: boolean;
  criticalThresholdPct: number;
};

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange() {
  const today = localToday();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const sy = start.getFullYear();
  const sm = String(start.getMonth() + 1).padStart(2, "0");
  const sd = String(start.getDate()).padStart(2, "0");
  return { start: `${sy}-${sm}-${sd}`, end: today };
}

function buildBaseSearch(start: string, end: string) {
  const p = new URLSearchParams();
  p.set("start_date", start);
  p.set("end_date", end);
  p.set("timezone", EXEC_ANALYTICS_TIMEZONE);
  return p;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function fmtCount(v: unknown): string {
  return Math.round(toNumber(v)).toLocaleString();
}

function fmtMoney(v: unknown): string {
  const n = toNumber(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: unknown): string {
  const n = toNumber(v);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function isoDate(d: Date): string {
  // Use local calendar date (not UTC) to avoid day-shifts in weekly windows.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeeklyWindows(asOfDate: string) {
  // Calendar-week comparison:
  // - Current week  : full calendar week Monday → Sunday (of selected week)
  // - Previous week : full calendar week Monday → Sunday immediately before
  const asOf = new Date(`${asOfDate}T00:00:00`);
  const today = new Date(`${localToday()}T00:00:00`);

  // Clamp selected date to today so future dates don't shift weekly windows.
  const effectiveEnd = asOf > today ? today : asOf;

  const weekdayIndex = (effectiveEnd.getDay() + 6) % 7; // Monday=0 … Sunday=6

  const thisWeekStart = new Date(effectiveEnd);
  thisWeekStart.setDate(thisWeekStart.getDate() - weekdayIndex);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 6); // Sunday

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); // Sunday before this Monday

  return {
    thisWeek: { start: isoDate(thisWeekStart), end: isoDate(thisWeekEnd) },
    lastWeek: { start: isoDate(lastWeekStart), end: isoDate(lastWeekEnd) },
  };
}

function growthPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatByUnit(value: number, unit: WeeklyMetricCard["unit"]) {
  if (unit === "money") return fmtMoney(value);
  if (unit === "percent") return fmtPct(value);
  return fmtCount(value);
}

function safeRatioPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function DashboardClient() {
  const defaults = useMemo(() => defaultDateRange(), []);

  const [tab, setTab] = useState("overview");

  /** Overview tab */
  const [ovStart, setOvStart] = useState(defaults.start);
  const [ovEnd, setOvEnd] = useState(defaults.end);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState<string | null>(null);

  /** Weekly tab */
  const [weeklyAsOf, setWeeklyAsOf] = useState(defaults.end);
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparisonBundle | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  /** Transactions tab */
  const [txStart, setTxStart] = useState(defaults.start);
  const [txEnd, setTxEnd] = useState(defaults.end);
  const [txGranularity, setTxGranularity] = useState<"day" | "week" | "month">("week");
  const [timeseries, setTimeseries] = useState<{ items?: TimeseriesApiItem[] } | null>(null);
  const [channels, setChannels] = useState<{ items?: { channel: string; tpv: string }[] } | null>(null);
  const [txOverview, setTxOverview] = useState<Record<string, unknown> | null>(null);
  const [tsError, setTsError] = useState<string | null>(null);
  const [chError, setChError] = useState<string | null>(null);
  const [txOverviewError, setTxOverviewError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txExporting, setTxExporting] = useState(false);
  const [txExportError, setTxExportError] = useState<string | null>(null);
  const [txTargetTpvStr, setTxTargetTpvStr] = useState("");
  const [txTargetCountStr, setTxTargetCountStr] = useState("");
  const skipNextTxTargetSave = useRef(true);

  /** Users tab */
  const [usStart, setUsStart] = useState(defaults.start);
  const [usEnd, setUsEnd] = useState(defaults.end);
  const [users, setUsers] = useState<Record<string, unknown> | null>(null);
  const [usLoading, setUsLoading] = useState(false);
  const [usError, setUsError] = useState<string | null>(null);

  /** Wallets tab */
  const [wlStart, setWlStart] = useState(defaults.start);
  const [wlEnd, setWlEnd] = useState(defaults.end);
  const [wlGranularity, setWlGranularity] = useState<"day" | "week" | "month">("week");
  const [wallets, setWallets] = useState<{ items?: WalletGrowthPoint[] } | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);

  /** Merchants tab */
  const [mcStart, setMcStart] = useState(defaults.start);
  const [mcEnd, setMcEnd] = useState(defaults.end);
  const [mcPeriod, setMcPeriod] = useState<"weekly" | "monthly">("weekly");
  const [mcSort, setMcSort] = useState<"tpv" | "count">("tpv");
  const [mcLimit, setMcLimit] = useState(10);
  const [merchants, setMerchants] = useState<{ items?: Record<string, unknown>[] } | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);

  /** Partners tab */
  const [paStart, setPaStart] = useState(defaults.start);
  const [paEnd, setPaEnd] = useState(defaults.end);
  const [paSort, setPaSort] = useState<"fee" | "count" | "name">("fee");
  const [paLimit, setPaLimit] = useState(10);
  const [partnersOverview, setPartnersOverview] = useState<Record<string, unknown> | null>(null);
  const [paLoading, setPaLoading] = useState(false);
  const [paError, setPaError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    setOvError(null);
    try {
      const p = buildBaseSearch(ovStart, ovEnd);
      const data = await fetchAnalyticsJson<Record<string, unknown>>("overview", p);

      setOverview(data);
    } catch (e) {
      setOverview(null);
      setOvError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setOvLoading(false);
    }
  }, [ovStart, ovEnd]);

  const loadWeeklyComparison = useCallback(async () => {
    setWeeklyLoading(true);
    setWeeklyError(null);
    try {
      const windows = getWeeklyWindows(weeklyAsOf);
      const [thisWeekOverview, lastWeekOverview, thisWeekUsers, lastWeekUsers] = await Promise.all([
        fetchAnalyticsJson<Record<string, unknown>>("overview", buildBaseSearch(windows.thisWeek.start, windows.thisWeek.end)),
        fetchAnalyticsJson<Record<string, unknown>>("overview", buildBaseSearch(windows.lastWeek.start, windows.lastWeek.end)),
        fetchAnalyticsJson<Record<string, unknown>>("users/activity", buildBaseSearch(windows.thisWeek.start, windows.thisWeek.end)),
        fetchAnalyticsJson<Record<string, unknown>>("users/activity", buildBaseSearch(windows.lastWeek.start, windows.lastWeek.end)),
      ]);
      setWeeklyComparison({ thisWeekOverview, lastWeekOverview, thisWeekUsers, lastWeekUsers });
    } catch (e) {
      setWeeklyComparison(null);
      setWeeklyError(e instanceof Error ? e.message : "Weekly comparison unavailable.");
    } finally {
      setWeeklyLoading(false);
    }
  }, [weeklyAsOf]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTsError(null);
    setChError(null);
    setTxOverviewError(null);
    const base = buildBaseSearch(txStart, txEnd);
    const tsParams = new URLSearchParams(base);
    tsParams.set("granularity", txGranularity);

    const [tsResult, chResult, ovResult] = await Promise.allSettled([
      fetchAnalyticsJson<{ items?: TimeseriesApiItem[] }>("transactions/timeseries", tsParams),
      fetchAnalyticsJson<{ items?: { channel: string; tpv: string }[] }>("tpv/by-channel", new URLSearchParams(base)),
      fetchAnalyticsJson<Record<string, unknown>>("overview", new URLSearchParams(base)),
    ]);

    if (tsResult.status === "fulfilled") {
      setTimeseries(tsResult.value);
    } else {
      setTimeseries(null);
      setTsError(tsResult.reason instanceof Error ? tsResult.reason.message : "Timeseries failed");
    }
    if (chResult.status === "fulfilled") {
      setChannels(chResult.value);
    } else {
      setChannels(null);
      setChError(chResult.reason instanceof Error ? chResult.reason.message : "Channel TPV failed");
    }
    if (ovResult.status === "fulfilled") {
      setTxOverview(ovResult.value);
    } else {
      setTxOverview(null);
      setTxOverviewError(ovResult.reason instanceof Error ? ovResult.reason.message : "Partner transaction breakdown failed");
    }
    setTxLoading(false);
  }, [txStart, txEnd, txGranularity]);

  const downloadTransactionsCsv = useCallback(async () => {
    setTxExporting(true);
    setTxExportError(null);
    try {
      const p = buildBaseSearch(txStart, txEnd);
      p.set("limit", "50000");
      const res = await fetch(`/api/analytics/transactions/export?${p.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "text/csv" },
      });
      const text = await res.text();
      if (!res.ok) {
        let message = text.trim() || res.statusText;
        try {
          const j = JSON.parse(text) as { detail?: unknown; error?: string };
          if (typeof j.detail === "string") message = j.detail;
          else if (Array.isArray(j.detail)) message = j.detail.map((d) => JSON.stringify(d)).join("; ");
          else if (typeof j.error === "string") message = j.error;
        } catch {
          // response was not JSON
        }
        throw new Error(message.length > 400 ? `${message.slice(0, 400)}…` : message);
      }
      const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
      const cd = res.headers.get("content-disposition");
      const quoted = cd?.match(/filename="([^"]+)"/i);
      const plain = cd?.match(/filename=([^;\s]+)/i);
      const rawName = quoted?.[1]?.trim() ?? plain?.[1]?.trim();
      const filename = rawName ?? `transactions_raw_${txStart}_${txEnd}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/^"+|"+$/g, "");
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setTxExportError(e instanceof Error ? e.message : "CSV export failed");
    } finally {
      setTxExporting(false);
    }
  }, [txStart, txEnd]);

  const loadUsers = useCallback(async () => {
    setUsLoading(true);
    setUsError(null);
    try {
      const p = buildBaseSearch(usStart, usEnd);
      const data = await fetchAnalyticsJson<Record<string, unknown>>("users/activity", p);
      setUsers(data);
    } catch (e) {
      setUsers(null);
      setUsError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setUsLoading(false);
    }
  }, [usStart, usEnd]);

  const loadWallets = useCallback(async () => {
    setWlLoading(true);
    setWlError(null);
    try {
      const p = buildBaseSearch(wlStart, wlEnd);
      p.set("granularity", wlGranularity);
      const data = await fetchAnalyticsJson<{ items?: WalletGrowthPoint[] }>("wallets/growth", p);
      setWallets(data);
    } catch (e) {
      setWallets(null);
      setWlError(e instanceof Error ? e.message : "Failed to load wallets");
    } finally {
      setWlLoading(false);
    }
  }, [wlStart, wlEnd, wlGranularity]);

  const loadMerchants = useCallback(async () => {
    setMcLoading(true);
    setMcError(null);
    try {
      const p = buildBaseSearch(mcStart, mcEnd);
      p.set("period", mcPeriod);
      p.set("sort_by", mcSort);
      p.set("limit", String(Math.min(100, Math.max(1, mcLimit))));
      p.set("offset", "0");
      const data = await fetchAnalyticsJson<{ items?: Record<string, unknown>[] }>("merchants/top", p);
      setMerchants(data);
    } catch (e) {
      setMerchants(null);
      setMcError(e instanceof Error ? e.message : "Failed to load merchants");
    } finally {
      setMcLoading(false);
    }
  }, [mcStart, mcEnd, mcPeriod, mcSort, mcLimit]);

  const loadPartners = useCallback(async () => {
    setPaLoading(true);
    setPaError(null);
    try {
      const p = buildBaseSearch(paStart, paEnd);
      const data = await fetchAnalyticsJson<Record<string, unknown>>("overview", p);
      setPartnersOverview(data);
    } catch (e) {
      setPartnersOverview(null);
      setPaError(e instanceof Error ? e.message : "Failed to load partners");
    } finally {
      setPaLoading(false);
    }
  }, [paStart, paEnd]);

  // Load when switching tabs only; use "Apply" to refetch with new filters (avoids refetch on every keystroke).
  useEffect(() => {
    if (tab === "overview") void loadOverview();
    else if (tab === "weekly") void loadWeeklyComparison();
    else if (tab === "transactions") void loadTransactions();
    else if (tab === "users") void loadUsers();
    else if (tab === "wallets") void loadWallets();
    else if (tab === "merchants") void loadMerchants();
    else if (tab === "partners") void loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally tab-only; loaders close over latest filters
  }, [tab]);

  // Keep numbers current while the dashboard stays open (uses the same loaders as Apply for the active tab).
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (tab === "overview") void loadOverview();
      else if (tab === "weekly") void loadWeeklyComparison();
      else if (tab === "transactions") void loadTransactions();
      else if (tab === "users") void loadUsers();
      else if (tab === "wallets") void loadWallets();
      else if (tab === "merchants") void loadMerchants();
      else if (tab === "partners") void loadPartners();
    };
    const id = window.setInterval(tick, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [tab, loadOverview, loadWeeklyComparison, loadTransactions, loadUsers, loadWallets, loadMerchants, loadPartners]);

  useEffect(() => {
    const t = loadTxTargets();
    setTxTargetTpvStr(t.tpv);
    setTxTargetCountStr(t.transactionCount);
  }, []);

  useEffect(() => {
    if (skipNextTxTargetSave.current) {
      skipNextTxTargetSave.current = false;
      return;
    }
    saveTxTargets({ tpv: txTargetTpvStr, transactionCount: txTargetCountStr });
  }, [txTargetTpvStr, txTargetCountStr]);

  const txItems = timeseries?.items ?? [];
  const txPartnerRows = Array.isArray(txOverview?.partner_fee_breakdown)
    ? (txOverview.partner_fee_breakdown as Array<Record<string, unknown>>)
    : [];
  const overviewPartnerRows = Array.isArray(overview?.partner_fee_breakdown)
    ? (overview.partner_fee_breakdown as Array<Record<string, unknown>>)
    : [];
  const partnerTabRowsRaw = Array.isArray(partnersOverview?.partner_fee_breakdown)
    ? (partnersOverview.partner_fee_breakdown as Array<Record<string, unknown>>)
    : [];
  const partnerTabRows = useMemo(() => {
    const sorted = [...partnerTabRowsRaw].sort((a, b) => {
      if (paSort === "count") {
        return Number(b.transaction_count ?? 0) - Number(a.transaction_count ?? 0);
      }
      if (paSort === "name") {
        return String(a.partner_name ?? "UNASSIGNED").localeCompare(String(b.partner_name ?? "UNASSIGNED"));
      }
      return Number(b.partner_fee_revenue ?? 0) - Number(a.partner_fee_revenue ?? 0);
    });
    return sorted.slice(0, Math.min(100, Math.max(1, paLimit)));
  }, [partnerTabRowsRaw, paSort, paLimit]);
  const partnerTabTotalFeePool = useMemo(() => {
    return partnerTabRows.reduce((acc, row) => acc + Number(row.partner_fee_revenue ?? 0), 0);
  }, [partnerTabRows]);
  const activePartnerCount = overviewPartnerRows.filter((r) => {
    const amount = Number(r.partner_fee_revenue ?? 0);
    return Number.isFinite(amount) && amount > 0;
  }).length;
  const partnerFeeTxCount = overviewPartnerRows.reduce((acc, row) => {
    const c = Number(row.transaction_count ?? 0);
    return acc + (Number.isFinite(c) ? c : 0);
  }, 0);
  const txActualTpv = useMemo(() => {
    const items = timeseries?.items ?? [];
    return items.length ? sumTimeseriesTpv(items) : null;
  }, [timeseries?.items]);
  const txActualCount = useMemo(() => {
    const items = timeseries?.items ?? [];
    return items.length ? sumTimeseriesTransactionCount(items) : null;
  }, [timeseries?.items]);
  const txBucketCount = txItems.length;

  const tpvTargetPerBucket = useMemo(() => {
    const t = parseTargetAmount(txTargetTpvStr);
    if (t == null || txBucketCount <= 0) return null;
    return t / txBucketCount;
  }, [txTargetTpvStr, txBucketCount]);

  const countTargetPerBucket = useMemo(() => {
    const t = parseTargetCount(txTargetCountStr);
    if (t == null || txBucketCount <= 0) return null;
    return t / txBucketCount;
  }, [txTargetCountStr, txBucketCount]);

  const weeklyMetricCards = useMemo<WeeklyMetricCard[]>(() => {
    if (!weeklyComparison) return [];
    const current = weeklyComparison.thisWeekOverview;
    const previous = weeklyComparison.lastWeekOverview;
    const currentUsers = weeklyComparison.thisWeekUsers;
    const previousUsers = weeklyComparison.lastWeekUsers;

    const currentTpv = toNumber(current.tpv);
    const previousTpv = toNumber(previous.tpv);
    const currentRukapayRevenue = toNumber(current.rukapay_fee_revenue);
    const previousRukapayRevenue = toNumber(previous.rukapay_fee_revenue);

    const currentTakeRate = safeRatioPct(currentRukapayRevenue, currentTpv);
    const previousTakeRate = safeRatioPct(previousRukapayRevenue, previousTpv);

    const currentTotalMerchants = toNumber(current.total_merchants);
    const previousTotalMerchants = toNumber(previous.total_merchants);
    const currentActivationRate = safeRatioPct(toNumber(current.active_merchants_30d), currentTotalMerchants);
    const previousActivationRate = safeRatioPct(toNumber(previous.active_merchants_30d), previousTotalMerchants);

    const currentTotalPartners = toNumber(current.total_partners);
    const previousTotalPartners = toNumber(previous.total_partners);
    const currentActivePartnersRate = safeRatioPct(toNumber(current.active_partners_30d), currentTotalPartners);
    const previousActivePartnersRate = safeRatioPct(toNumber(previous.active_partners_30d), previousTotalPartners);

    const currentTotalUsers = toNumber(current.total_users);
    const previousTotalUsers = toNumber(previous.total_users);
    const currentActiveUsersRate = safeRatioPct(toNumber(currentUsers.active_users_30d), currentTotalUsers);
    const previousActiveUsersRate = safeRatioPct(toNumber(previousUsers.active_users_30d), previousTotalUsers);

    return [
      {
        id: "tpv",
        label: "TPV",
        thisWeek: currentTpv,
        lastWeek: previousTpv,
        unit: "money",
        higherIsBetter: true,
        criticalThresholdPct: 5,
      },
      {
        id: "transactions",
        label: "Transactions",
        thisWeek: toNumber(current.transaction_count),
        lastWeek: toNumber(previous.transaction_count),
        unit: "count",
        higherIsBetter: true,
        criticalThresholdPct: 5,
      },
      {
        id: "rukapay-revenue",
        label: "RukaPay revenue",
        thisWeek: currentRukapayRevenue,
        lastWeek: previousRukapayRevenue,
        unit: "money",
        higherIsBetter: true,
        criticalThresholdPct: 5,
      },
      {
        id: "success-rate",
        label: "Success rate",
        thisWeek: toNumber(current.success_rate),
        lastWeek: toNumber(previous.success_rate),
        unit: "percent",
        higherIsBetter: true,
        criticalThresholdPct: 2,
      },
      {
        id: "take-rate",
        label: "Take rate (RukaPay revenue / TPV)",
        thisWeek: currentTakeRate,
        lastWeek: previousTakeRate,
        unit: "percent",
        higherIsBetter: true,
        criticalThresholdPct: 2,
      },
      {
        id: "merchant-activation",
        label: "Merchant activation rate",
        thisWeek: currentActivationRate,
        lastWeek: previousActivationRate,
        unit: "percent",
        higherIsBetter: true,
        criticalThresholdPct: 3,
      },
      {
        id: "users-active-rate",
        label: "Active users ratio",
        thisWeek: currentActiveUsersRate,
        lastWeek: previousActiveUsersRate,
        unit: "percent",
        higherIsBetter: true,
        criticalThresholdPct: 3,
      },
      {
        id: "partners-active-rate",
        label: "Active partners ratio",
        thisWeek: currentActivePartnersRate,
        lastWeek: previousActivePartnersRate,
        unit: "percent",
        higherIsBetter: true,
        criticalThresholdPct: 3,
      },
      {
        id: "reversal-rate",
        label: "Reversal rate",
        thisWeek: toNumber(current.reversal_rate),
        lastWeek: toNumber(previous.reversal_rate),
        unit: "percent",
        higherIsBetter: false,
        criticalThresholdPct: 2,
      },
    ];
  }, [weeklyComparison]);

  const weeklyActionFlags = useMemo(() => {
    return weeklyMetricCards
      .map((m) => {
        const delta = growthPct(m.thisWeek, m.lastWeek);
        const improving = m.higherIsBetter ? delta >= 0 : delta <= 0;
        const status = improving ? "healthy" : Math.abs(delta) >= m.criticalThresholdPct ? "critical" : "watch";
        return { ...m, delta, status };
      })
      .filter((m) => m.status !== "healthy");
  }, [weeklyMetricCards]);

  const weeklyWindows = useMemo(() => getWeeklyWindows(weeklyAsOf), [weeklyAsOf]);

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 h-auto min-h-10">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="wallets">Wallets</TabsTrigger>
        <TabsTrigger value="partners">Partners</TabsTrigger>
        <TabsTrigger value="merchants">Merchants</TabsTrigger>
      </TabsList>
      <p className="text-xs text-muted-foreground">
        Timezone: <span className="font-medium text-foreground/80">Kampala</span> ({EXEC_ANALYTICS_TIMEZONE}) · Active tab
        refreshes every {AUTO_REFRESH_MS / 60_000} minutes
      </p>

      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit">Overview filters</CardTitle>
            <CardDescription>
              KPIs for the selected range (defaults: last 30 days). <strong className="text-foreground/90">TPV</strong> = total payment
              volume; fees are revenue from successful transactions in range.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="ov-start">Start</Label>
              <Input id="ov-start" type="date" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ov-end">End</Label>
              <Input id="ov-end" type="date" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void loadOverview()} disabled={ovLoading}>
              {ovLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {ovError ? (
          <AnalyticsErrorAlert message={ovError} onRetry={() => void loadOverview()} isRetrying={ovLoading} context="Overview" />
        ) : null}
        {ovLoading && !overview ? <OverviewLoadingSkeleton /> : null}
        {overview ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={
                <abbr
                  title="Total payment volume — sum of successful transaction amounts in the range"
                  className="font-medium text-foreground no-underline cursor-help border-b border-dotted border-muted-foreground/60"
                >
                  TPV
                </abbr>
              }
              sublabel="Total payment volume (successful transactions)"
              value={fmtMoney(overview.tpv)}
            />
            <KpiCard
              label="Transactions"
              sublabel="successful transactions in the selected range"
              value={fmtCount(overview.transaction_count)}
            />
            <KpiCard
              label="Success rate"
              sublabel="% of transaction attempts that completed successfully (0–100)"
              value={fmtPct(overview.success_rate)}
            />
            <KpiCard
              label="RukaPay revenue"
              sublabel="Our platform revenue only (rukapayFee) from successful transactions"
              value={fmtMoney(overview.rukapay_fee_revenue)}
            />
            <KpiCard
              label="Total fees charged (all components)"
              sublabel="Full fee pool = RukaPay + partner/network/tax fees (successful txs)"
              value={fmtMoney(overview.total_fee_revenue)}
            />
            <KpiCard
              label="Base tariff fee"
              sublabel="Sum of transactions.fee (successful txs)"
              value={fmtMoney(overview.base_fee_revenue)}
            />
            <KpiCard
              label="Partner / network / tax fees"
              sublabel="thirdParty + network + processing + compliance + governmentTax (successful txs)"
              value={fmtMoney(overview.partner_fee_revenue)}
            />
            <KpiCard
              label="RukaPay share of total fees"
              sublabel="% of total fee pool retained by RukaPay"
              value={fmtPct(safeRatioPct(toNumber(overview.rukapay_fee_revenue), toNumber(overview.total_fee_revenue)))}
            />
            <KpiCard
              label="Partners with fee activity"
              sublabel="Distinct partners contributing partner/network/tax fees in range"
              value={fmtCount(activePartnerCount)}
            />
            <KpiCard
              label="Partner fee tx count"
              sublabel="Successful transactions that contributed partner/network/tax fees"
              value={fmtCount(partnerFeeTxCount)}
            />
            <KpiCard
              label="Active users (30d)"
              sublabel="users with ≥1 successful tx in trailing 30 days (from end date)"
              value={fmtCount(overview.active_users_30d)}
            />
            <KpiCard
              label="Take rate (RukaPay)"
              sublabel="RukaPay revenue / TPV in selected range"
              value={fmtPct(safeRatioPct(toNumber(overview.rukapay_fee_revenue), toNumber(overview.tpv)))}
            />
            <KpiCard
              label="Merchant activation rate"
              sublabel="active merchants (30d) / total merchants"
              value={fmtPct(safeRatioPct(toNumber(overview.active_merchants_30d), toNumber(overview.total_merchants)))}
            />
            <KpiCard
              label="Active users ratio"
              sublabel="active users (30d) / total users"
              value={fmtPct(safeRatioPct(toNumber(overview.active_users_30d), toNumber(overview.total_users)))}
            />
            <KpiCard
              label="Active partners ratio"
              sublabel="active partners (30d) / total partners"
              value={fmtPct(safeRatioPct(toNumber(overview.active_partners_30d), toNumber(overview.total_partners)))}
            />
            <KpiCard label="Total users" sublabel="all registered users" value={fmtCount(overview.total_users)} />
            <KpiCard label="Total merchants" sublabel="all registered merchants" value={fmtCount(overview.total_merchants)} />
            <KpiCard label="Total partners" sublabel="all registered API partners" value={fmtCount(overview.total_partners)} />
            <KpiCard label="New wallets" sublabel="wallets created in the selected range" value={fmtCount(overview.new_wallets)} />
            <KpiCard label="New merchants" sublabel="merchant records created in the selected range" value={fmtCount(overview.new_merchants)} />
          </section>
        ) : null}
        {overview && overviewPartnerRows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-outfit">Partner fee breakdown</CardTitle>
              <CardDescription>Partner-level share of non-RukaPay fee components for successful transactions.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 text-muted-foreground">Partner</th>
                    <th className="py-2 pr-4 text-muted-foreground">TPV</th>
                    <th className="py-2 pr-4 text-muted-foreground">Fee Revenue</th>
                    <th className="py-2 pr-4 text-muted-foreground">Tx Count</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewPartnerRows.map((row, i) => (
                    <tr key={`${String(row.partner_id ?? "na")}-${i}`} className="border-b border-border/60">
                      <td className="py-2 pr-4">{String(row.partner_name ?? "UNASSIGNED")}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.partner_fee_revenue)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtCount(row.transaction_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="weekly" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit">Weekly comparison</CardTitle>
            <CardDescription>
              Current week is full calendar week (Monday to Sunday). Previous week is the immediately preceding Monday to Sunday week.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="weekly-as-of">As of date</Label>
              <Input id="weekly-as-of" type="date" value={weeklyAsOf} onChange={(e) => setWeeklyAsOf(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void loadWeeklyComparison()} disabled={weeklyLoading}>
              {weeklyLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {weeklyError ? (
          <AnalyticsErrorAlert
            message={weeklyError}
            onRetry={() => void loadWeeklyComparison()}
            isRetrying={weeklyLoading}
            context="Weekly comparison"
          />
        ) : null}
        {weeklyLoading && !weeklyComparison ? <OverviewLoadingSkeleton /> : null}
        {weeklyMetricCards.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-outfit">Weekly decision view</CardTitle>
              <CardDescription>
                This week ({weeklyWindows.thisWeek.start} to {weeklyWindows.thisWeek.end}) vs last week ({weeklyWindows.lastWeek.start} to{" "}
                {weeklyWindows.lastWeek.end}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-foreground/80">
                  Current week: {weeklyWindows.thisWeek.start} → {weeklyWindows.thisWeek.end}
                </span>
                <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-foreground/80">
                  Previous week: {weeklyWindows.lastWeek.start} → {weeklyWindows.lastWeek.end}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {weeklyMetricCards.map((metric) => {
                  const delta = growthPct(metric.thisWeek, metric.lastWeek);
                  const improving = metric.higherIsBetter ? delta >= 0 : delta <= 0;
                  const isCritical = !improving && Math.abs(delta) >= metric.criticalThresholdPct;
                  const isWatch = !improving && !isCritical;
                  const colorClass = isCritical ? "text-red-600" : isWatch ? "text-amber-600" : "text-emerald-600";
                  const DeltaIcon = improving ? ArrowUpRight : delta === 0 ? Minus : ArrowDownRight;
                  return (
                    <div key={metric.id} className="rounded-lg border p-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-lg font-semibold tabular-nums">{formatByUnit(metric.thisWeek, metric.unit)}</p>
                      <p className="text-xs text-muted-foreground">Last week: {formatByUnit(metric.lastWeek, metric.unit)}</p>
                      <p className={`text-xs font-medium inline-flex items-center gap-1 ${colorClass}`}>
                        <DeltaIcon className="h-3.5 w-3.5" />
                        {fmtPct(Math.abs(delta))} {improving ? "improving" : "declining"}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium mb-2">Immediate action flags</p>
                {weeklyActionFlags.length === 0 ? (
                  <p className="text-sm text-emerald-700 inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    No critical regression this week.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {weeklyActionFlags.map((m) => {
                      const critical = m.status === "critical";
                      return (
                        <li key={`${m.id}-flag`} className={`inline-flex items-center gap-2 ${critical ? "text-red-700" : "text-amber-700"}`}>
                          <AlertTriangle className="h-4 w-4" />
                          {m.label} is {fmtPct(Math.abs(m.delta))} {m.delta < 0 ? "down" : "up"} week-on-week
                          {critical ? " (critical)" : " (watch)"}.
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ) : !weeklyError && !weeklyLoading ? (
          <p className="text-muted-foreground text-sm">No weekly comparison data for this selection.</p>
        ) : null}
      </TabsContent>

      <TabsContent value="transactions" className="space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-0">
            <CardTitle className="font-outfit text-base">Transactions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="tx-start" className="text-xs">
                Start
              </Label>
              <Input id="tx-start" type="date" value={txStart} onChange={(e) => setTxStart(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-end" className="text-xs">
                End
              </Label>
              <Input id="tx-end" type="date" value={txEnd} onChange={(e) => setTxEnd(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Granularity</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["day", "week", "month"] as const).map((g) => (
                  <Button key={g} type="button" variant={txGranularity === g ? "default" : "outline"} size="sm" className="h-8" onClick={() => setTxGranularity(g)}>
                    {g}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="button" size="sm" className="h-9" onClick={() => void loadTransactions()} disabled={txLoading}>
              {txLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void downloadTransactionsCsv()}
              disabled={txExporting || txLoading}
              title="Raw transaction rows for the selected date range (up to 50,000 rows). Opens as CSV in Excel."
            >
              {txExporting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-1.5" aria-hidden />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1.5" aria-hidden />
                  Download CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        {txExportError ? <p className="text-sm text-red-600 px-1">{txExportError}</p> : null}
        <TransactionTargetsComparison
          targetTpvInput={txTargetTpvStr}
          targetCountInput={txTargetCountStr}
          onTargetTpvChange={setTxTargetTpvStr}
          onTargetCountChange={setTxTargetCountStr}
          actualTpv={txActualTpv}
          actualTxCount={txActualCount}
        />
        {tsError || chError || txOverviewError ? (
          <div className="space-y-2">
            {tsError ? (
              <AnalyticsErrorAlert
                context="Volume over time"
                message={tsError}
                onRetry={() => void loadTransactions()}
                isRetrying={txLoading}
              />
            ) : null}
            {chError ? (
              <AnalyticsErrorAlert
                context="Channel breakdown"
                message={chError}
                onRetry={() => void loadTransactions()}
                isRetrying={txLoading}
              />
            ) : null}
            {txOverviewError ? (
              <AnalyticsErrorAlert
                context="Partner transaction breakdown"
                message={txOverviewError}
                onRetry={() => void loadTransactions()}
                isRetrying={txLoading}
              />
            ) : null}
          </div>
        ) : null}
        {txLoading && !timeseries && !channels ? <TransactionsLoadingSkeleton /> : null}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          {timeseries?.items?.length ? (
            <Card className="flex flex-col overflow-visible">
              <CardHeader className="py-3 pb-2 space-y-0">
                <CardTitle className="font-outfit text-base">Volume (TPV)</CardTitle>
                <CardDescription className="text-xs">Weekly comparison trend (switch granularity when needed) · dashed line = target pace per bucket</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4 overflow-visible">
                <TimeseriesLineChart
                  data={timeseries.items}
                  metric="tpv"
                  height={280}
                  targetReference={tpvTargetPerBucket}
                />
              </CardContent>
            </Card>
          ) : null}
          {timeseries?.items?.length ? (
            <Card className="flex flex-col overflow-visible">
              <CardHeader className="py-3 pb-2 space-y-0">
                <CardTitle className="font-outfit text-base">Transactions (count)</CardTitle>
                <CardDescription className="text-xs">Bucket-level count with week-on-week direction available below</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4 overflow-visible">
                <TimeseriesLineChart
                  data={timeseries.items}
                  metric="transaction_count"
                  height={280}
                  targetReference={countTargetPerBucket}
                />
              </CardContent>
            </Card>
          ) : null}
          {channels?.items?.length ? (
            <Card className="flex flex-col overflow-visible lg:col-span-2">
              <CardHeader className="py-3 pb-2 space-y-0">
                <CardTitle className="font-outfit text-base">By channel</CardTitle>
                <CardDescription className="text-xs">TPV per channel</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4 overflow-visible">
                <ChannelBarChart data={channels.items} height={280} />
              </CardContent>
            </Card>
          ) : null}
        </div>
        {timeseries?.items?.length ? (
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="font-outfit text-base">Trend summary table</CardTitle>
              <CardDescription className="text-xs">Fast week-on-week scan of TPV movement and transaction counts.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pt-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 text-muted-foreground">Bucket</th>
                    <th className="py-2 pr-4 text-muted-foreground">TPV</th>
                    <th className="py-2 pr-4 text-muted-foreground">Tx count</th>
                    <th className="py-2 pr-4 text-muted-foreground">WoW TPV %</th>
                    <th className="py-2 pr-4 text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeseries.items.map((row) => {
                    const tpvPct = row.vs_previous_tpv_pct == null ? null : toNumber(row.vs_previous_tpv_pct);
                    const trend = String(row.vs_previous_tpv_trend || "n/a");
                    const statusClass =
                      trend === "decrease" ? "text-red-600" : trend === "increase" ? "text-emerald-600" : "text-muted-foreground";
                    return (
                      <tr key={String(row.bucket_start)} className="border-b border-border/60">
                        <td className="py-2 pr-4">{String(row.bucket_start).slice(0, 10)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtCount(row.transaction_count)}</td>
                        <td className="py-2 pr-4 tabular-nums">{tpvPct == null ? "—" : fmtPct(tpvPct)}</td>
                        <td className={`py-2 pr-4 capitalize ${statusClass}`}>{trend}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="font-outfit text-base">Partner transaction activity</CardTitle>
            <CardDescription className="text-xs">
              Partner-level fee activity for the selected transactions date range.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {txPartnerRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4 text-muted-foreground">Partner</th>
                      <th className="py-2 pr-4 text-muted-foreground">TPV</th>
                      <th className="py-2 pr-4 text-muted-foreground">Fee revenue</th>
                      <th className="py-2 pr-4 text-muted-foreground">Tx count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txPartnerRows.map((row, i) => (
                      <tr key={`${String(row.partner_id ?? "na")}-${i}`} className="border-b border-border/60">
                        <td className="py-2 pr-4">{String(row.partner_name ?? "UNASSIGNED")}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.partner_fee_revenue)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtCount(row.transaction_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No partner fee activity found for this date range.</p>
            )}
          </CardContent>
        </Card>
        {!txLoading &&
        !tsError &&
        !chError &&
        !txOverviewError &&
        (!timeseries?.items?.length || timeseries.items.length === 0) &&
        (!channels?.items?.length || channels.items.length === 0) &&
        txPartnerRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No chart data for this range.</p>
        ) : null}
      </TabsContent>

      <TabsContent value="users" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit">User activity filters</CardTitle>
            <CardDescription>
              <strong>DAU</strong> = daily active users · <strong>WAU</strong> = weekly active · <strong>MAU</strong> = monthly active (successful
              transactions). Segments split retail subscribers vs merchant accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="us-start">Start</Label>
              <Input id="us-start" type="date" value={usStart} onChange={(e) => setUsStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="us-end">End</Label>
              <Input id="us-end" type="date" value={usEnd} onChange={(e) => setUsEnd(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void loadUsers()} disabled={usLoading}>
              {usLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {usError ? (
          <AnalyticsErrorAlert message={usError} onRetry={() => void loadUsers()} isRetrying={usLoading} context="User activity" />
        ) : null}
        {usLoading && !users ? <UsersLoadingSkeleton /> : null}
        {users ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-outfit">User activity</CardTitle>
                <CardDescription>Counts use rolling windows anchored on the range end date (Kampala time).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <MetricAbbrev abbr="DAU" full="daily active users" value={fmtCount(users.dau)} />
                <MetricAbbrev abbr="WAU" full="weekly active users" value={fmtCount(users.wau)} />
                <MetricAbbrev abbr="MAU" full="monthly active users" value={fmtCount(users.mau)} />
                <MetricAbbrev
                  abbr="Active 30d"
                  full="users with successful activity in trailing 30 days"
                  value={fmtCount(users.active_users_30d)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-outfit">Subscribers vs merchants</CardTitle>
                <CardDescription>Subscribers = retail users without a merchant profile; merchants = users with a merchant record.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {(["subscribers", "merchants"] as const).map((key) => {
                  const seg = users[key] as Record<string, unknown> | undefined;
                  if (!seg) return null;
                  return (
                    <div key={key} className="rounded-lg border p-3 space-y-2">
                      <p className="font-medium capitalize">{key}</p>
                      <SegmentMetricLine abbr="DAU" full="daily active users" value={fmtCount(seg.dau)} />
                      <SegmentMetricLine abbr="WAU" full="weekly active users" value={fmtCount(seg.wau)} />
                      <SegmentMetricLine abbr="MAU" full="monthly active users" value={fmtCount(seg.mau)} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="wallets" className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-outfit text-base">Wallets</CardTitle>
            <CardDescription className="text-xs">Date range · bucket size</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="wl-start">Start</Label>
              <Input id="wl-start" type="date" value={wlStart} onChange={(e) => setWlStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-end">End</Label>
              <Input id="wl-end" type="date" value={wlEnd} onChange={(e) => setWlEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Granularity</Label>
              <div className="flex flex-wrap gap-2">
                {(["day", "week", "month"] as const).map((g) => (
                  <Button key={g} type="button" variant={wlGranularity === g ? "default" : "outline"} size="sm" onClick={() => setWlGranularity(g)}>
                    {g}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="button" onClick={() => void loadWallets()} disabled={wlLoading}>
              {wlLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {wlError ? (
          <AnalyticsErrorAlert message={wlError} onRetry={() => void loadWallets()} isRetrying={wlLoading} context="Wallets" />
        ) : null}
        {wlLoading && !wallets?.items?.length ? <WalletChartLoadingSkeleton /> : null}
        {wallets?.items?.length ? (
          <Card className="overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="font-outfit text-base">New wallets by type</CardTitle>
              <CardDescription className="text-xs">Personal vs merchant (business) per bucket</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-visible">
              <WalletGrowthLineChart
                data={wallets.items.map((i) => ({
                  bucket_start: String(i.bucket_start),
                  new_personal_wallets: i.new_personal_wallets,
                  new_business_wallets: i.new_business_wallets,
                }))}
              />
            </CardContent>
          </Card>
        ) : !wlError && !wlLoading ? (
          <p className="text-muted-foreground text-sm">No wallet growth data for this range.</p>
        ) : null}
      </TabsContent>

      <TabsContent value="merchants" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit">Top merchants filters</CardTitle>
            <CardDescription>Ranking window, sort, and page size.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="mc-start">Start</Label>
              <Input id="mc-start" type="date" value={mcStart} onChange={(e) => setMcStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-end">End</Label>
              <Input id="mc-end" type="date" value={mcEnd} onChange={(e) => setMcEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <div className="flex gap-2">
                {(["weekly", "monthly"] as const).map((p) => (
                  <Button key={p} type="button" variant={mcPeriod === p ? "default" : "outline"} size="sm" onClick={() => setMcPeriod(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sort by</Label>
              <div className="flex gap-2">
                {(
                  [
                    { id: "tpv" as const, label: "tpv", title: "Sort by total payment volume" },
                    { id: "count" as const, label: "count", title: "Sort by number of successful transactions" },
                  ] as const
                ).map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={mcSort === s.id ? "default" : "outline"}
                    size="sm"
                    title={s.title}
                    onClick={() => setMcSort(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-limit">Limit</Label>
              <Input
                id="mc-limit"
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={mcLimit}
                onChange={(e) => setMcLimit(parseInt(e.target.value, 10) || 10)}
              />
            </div>
            <Button type="button" onClick={() => void loadMerchants()} disabled={mcLoading}>
              {mcLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {mcError ? (
          <AnalyticsErrorAlert message={mcError} onRetry={() => void loadMerchants()} isRetrying={mcLoading} context="Merchants" />
        ) : null}
        {mcLoading && !merchants ? <MerchantsTableLoadingSkeleton /> : null}
        {merchants?.items?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-outfit">Top merchants</CardTitle>
              <CardDescription>
                {mcPeriod} period · sorted by {mcSort} · top {Math.min(100, Math.max(1, mcLimit))}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 text-muted-foreground align-bottom">#</th>
                    <th className="py-2 pr-4 text-muted-foreground align-bottom">Merchant</th>
                    <ThAbbr abbr="TPV" full="Total payment volume" />
                    <ThAbbr abbr="RukaPay fees" full="Sum of rukapayFee on successful txs" />
                    <ThAbbr abbr="TPV growth %" full="vs prior period of same length" />
                  </tr>
                </thead>
                <tbody>
                  {merchants.items.map((row, i) => (
                    <tr key={String(row.merchant_id ?? i)} className="border-b border-border/60">
                      <td className="py-2 pr-4">{(row.rank as number) ?? i + 1}</td>
                      <td className="py-2 pr-4">{(row.merchant_name as string) ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.rukapay_fee_revenue)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv_growth_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : !mcError && !mcLoading ? (
          <p className="text-muted-foreground text-sm">No merchant ranking data for this range.</p>
        ) : null}
      </TabsContent>

      <TabsContent value="partners" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit">Partner activity filters</CardTitle>
            <CardDescription>Date range, ranking sort, and result limit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="pa-start">Start</Label>
              <Input id="pa-start" type="date" value={paStart} onChange={(e) => setPaStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-end">End</Label>
              <Input id="pa-end" type="date" value={paEnd} onChange={(e) => setPaEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sort by</Label>
              <div className="flex gap-2">
                {(
                  [
                    { id: "fee" as const, label: "fee revenue" },
                    { id: "count" as const, label: "tx count" },
                    { id: "name" as const, label: "name" },
                  ] as const
                ).map((s) => (
                  <Button key={s.id} type="button" variant={paSort === s.id ? "default" : "outline"} size="sm" onClick={() => setPaSort(s.id)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-limit">Limit</Label>
              <Input
                id="pa-limit"
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={paLimit}
                onChange={(e) => setPaLimit(parseInt(e.target.value, 10) || 10)}
              />
            </div>
            <Button type="button" onClick={() => void loadPartners()} disabled={paLoading}>
              {paLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </CardContent>
        </Card>
        {paError ? (
          <AnalyticsErrorAlert message={paError} onRetry={() => void loadPartners()} isRetrying={paLoading} context="Partners" />
        ) : null}
        {paLoading && !partnersOverview ? <MerchantsTableLoadingSkeleton /> : null}
        {partnerTabRows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-outfit">Top partners</CardTitle>
              <CardDescription>
                Sorted by {paSort === "fee" ? "fee revenue" : paSort === "count" ? "transaction count" : "name"} · top{" "}
                {Math.min(100, Math.max(1, paLimit))}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 text-muted-foreground align-bottom">#</th>
                    <th className="py-2 pr-4 text-muted-foreground align-bottom">Partner</th>
                    <ThAbbr abbr="TPV" full="Total payment volume originated by this partner" />
                    <ThAbbr abbr="Fee revenue" full="Partner/network/tax fee revenue contributed by this partner" />
                    <ThAbbr abbr="Tx count" full="Successful transactions with partner fee activity" />
                    <ThAbbr abbr="Share %" full="Partner share of displayed fee pool" />
                  </tr>
                </thead>
                <tbody>
                  {partnerTabRows.map((row, i) => {
                    const feeRevenue = Number(row.partner_fee_revenue ?? 0);
                    const sharePct = safeRatioPct(feeRevenue, partnerTabTotalFeePool);
                    return (
                      <tr key={`${String(row.partner_id ?? "na")}-${i}`} className="border-b border-border/60">
                        <td className="py-2 pr-4">{i + 1}</td>
                        <td className="py-2 pr-4">{String(row.partner_name ?? "UNASSIGNED")}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtMoney(row.tpv)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtMoney(feeRevenue)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtCount(row.transaction_count)}</td>
                        <td className="py-2 pr-4 tabular-nums">{fmtPct(sharePct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : !paError && !paLoading ? (
          <p className="text-muted-foreground text-sm">No partner activity data for this range.</p>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
