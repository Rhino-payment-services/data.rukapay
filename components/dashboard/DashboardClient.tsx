"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { KpiCard, MetricAbbrev, SegmentMetricLine, ThAbbr } from "@/components/dashboard/MetricAbbrev";
import { fetchAnalyticsJson } from "@/lib/analytics-fetch";

/** All analytics requests use Kampala (EAT); matches data_service default. */
const EXEC_ANALYTICS_TIMEZONE = "Africa/Kampala" as const;

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function buildBaseSearch(start: string, end: string) {
  const p = new URLSearchParams();
  p.set("start_date", start);
  p.set("end_date", end);
  p.set("timezone", EXEC_ANALYTICS_TIMEZONE);
  return p;
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

  /** Transactions tab */
  const [txStart, setTxStart] = useState(defaults.start);
  const [txEnd, setTxEnd] = useState(defaults.end);
  const [txGranularity, setTxGranularity] = useState<"day" | "week" | "month">("day");
  const [timeseries, setTimeseries] = useState<{ items?: { bucket_start: string; tpv: string }[] } | null>(null);
  const [channels, setChannels] = useState<{ items?: { channel: string; tpv: string }[] } | null>(null);
  const [tsError, setTsError] = useState<string | null>(null);
  const [chError, setChError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);

  /** Users tab */
  const [usStart, setUsStart] = useState(defaults.start);
  const [usEnd, setUsEnd] = useState(defaults.end);
  const [users, setUsers] = useState<Record<string, unknown> | null>(null);
  const [usLoading, setUsLoading] = useState(false);
  const [usError, setUsError] = useState<string | null>(null);

  /** Wallets tab */
  const [wlStart, setWlStart] = useState(defaults.start);
  const [wlEnd, setWlEnd] = useState(defaults.end);
  const [wlGranularity, setWlGranularity] = useState<"day" | "week" | "month">("day");
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

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTsError(null);
    setChError(null);
    const base = buildBaseSearch(txStart, txEnd);
    const tsParams = new URLSearchParams(base);
    tsParams.set("granularity", txGranularity);

    const [tsResult, chResult] = await Promise.allSettled([
      fetchAnalyticsJson<{ items?: { bucket_start: string; tpv: string }[] }>("transactions/timeseries", tsParams),
      fetchAnalyticsJson<{ items?: { channel: string; tpv: string }[] }>("tpv/by-channel", new URLSearchParams(base)),
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
    setTxLoading(false);
  }, [txStart, txEnd, txGranularity]);

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

  // Load when switching tabs only; use "Apply" to refetch with new filters (avoids refetch on every keystroke).
  useEffect(() => {
    if (tab === "overview") void loadOverview();
    else if (tab === "transactions") void loadTransactions();
    else if (tab === "users") void loadUsers();
    else if (tab === "wallets") void loadWallets();
    else if (tab === "merchants") void loadMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally tab-only; loaders close over latest filters
  }, [tab]);

  const fmtMoney = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    if (Number.isNaN(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto min-h-10">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="wallets">Wallets</TabsTrigger>
        <TabsTrigger value="merchants" className="col-span-2 sm:col-span-1">
          Merchants
        </TabsTrigger>
      </TabsList>
      <p className="text-xs text-muted-foreground">
        Timezone: <span className="font-medium text-foreground/80">Kampala</span> ({EXEC_ANALYTICS_TIMEZONE})
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
        {ovError ? <AnalyticsErrorAlert message={ovError} /> : null}
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
              value={String(overview.transaction_count ?? "—")}
            />
            <KpiCard
              label="Success rate"
              sublabel="% of transaction attempts that completed successfully (0–100)"
              value={`${fmtMoney(overview.success_rate)}%`}
            />
            <KpiCard label="Total fee revenue" sublabel="all fee components on successful txs" value={fmtMoney(overview.total_fee_revenue)} />
            <KpiCard
              label="RukaPay fee revenue"
              sublabel="platform fee (rukapayFee) on successful txs"
              value={fmtMoney(overview.rukapay_fee_revenue)}
            />
            <KpiCard
              label="Active users (30d)"
              sublabel="users with ≥1 successful tx in trailing 30 days (from end date)"
              value={String(overview.active_users_30d ?? "—")}
            />
            <KpiCard label="New wallets" sublabel="wallets created in the selected range" value={String(overview.new_wallets ?? "—")} />
            <KpiCard label="New merchants" sublabel="merchant records created in the selected range" value={String(overview.new_merchants ?? "—")} />
          </section>
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
          </CardContent>
        </Card>
        {tsError || chError ? (
          <div className="space-y-2">
            {tsError ? <AnalyticsErrorAlert message={`Volume over time: ${tsError}`} /> : null}
            {chError ? <AnalyticsErrorAlert message={`Channel breakdown: ${chError}`} /> : null}
          </div>
        ) : null}
        {txLoading && !timeseries && !channels ? <TransactionsLoadingSkeleton /> : null}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          {timeseries?.items?.length ? (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 pb-2 space-y-0">
                <CardTitle className="font-outfit text-base">Volume (TPV)</CardTitle>
                <CardDescription className="text-xs">Successful tx amounts over time</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <TimeseriesLineChart data={timeseries.items} height={200} />
              </CardContent>
            </Card>
          ) : null}
          {channels?.items?.length ? (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 pb-2 space-y-0">
                <CardTitle className="font-outfit text-base">By channel</CardTitle>
                <CardDescription className="text-xs">TPV per channel</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <ChannelBarChart data={channels.items} height={200} />
              </CardContent>
            </Card>
          ) : null}
        </div>
        {!txLoading &&
        !tsError &&
        !chError &&
        (!timeseries?.items?.length || timeseries.items.length === 0) &&
        (!channels?.items?.length || channels.items.length === 0) ? (
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
        {usError ? <AnalyticsErrorAlert message={usError} /> : null}
        {usLoading && !users ? <UsersLoadingSkeleton /> : null}
        {users ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-outfit">User activity</CardTitle>
                <CardDescription>Counts use rolling windows anchored on the range end date (Kampala time).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <MetricAbbrev abbr="DAU" full="daily active users" value={String(users.dau ?? "—")} />
                <MetricAbbrev abbr="WAU" full="weekly active users" value={String(users.wau ?? "—")} />
                <MetricAbbrev abbr="MAU" full="monthly active users" value={String(users.mau ?? "—")} />
                <MetricAbbrev
                  abbr="Active 30d"
                  full="users with successful activity in trailing 30 days"
                  value={String(users.active_users_30d ?? "—")}
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
                      <SegmentMetricLine abbr="DAU" full="daily active users" value={String(seg.dau ?? "—")} />
                      <SegmentMetricLine abbr="WAU" full="weekly active users" value={String(seg.wau ?? "—")} />
                      <SegmentMetricLine abbr="MAU" full="monthly active users" value={String(seg.mau ?? "—")} />
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
        {wlError ? <AnalyticsErrorAlert message={wlError} /> : null}
        {wlLoading && !wallets?.items?.length ? <WalletChartLoadingSkeleton /> : null}
        {wallets?.items?.length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-outfit text-base">New wallets by type</CardTitle>
              <CardDescription className="text-xs">Personal vs merchant (business) per bucket</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
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
        {mcError ? <AnalyticsErrorAlert message={mcError} /> : null}
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
    </Tabs>
  );
}
