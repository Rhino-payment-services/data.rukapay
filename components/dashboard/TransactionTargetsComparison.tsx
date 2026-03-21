"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseTargetAmount, parseTargetCount } from "@/lib/timeseries-aggregate";
import { cn } from "@/lib/utils";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctOfTarget(actual: number, target: number): string {
  if (target <= 0) return "—";
  return `${((actual / target) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function varianceTone(actual: number, target: number | null): string {
  if (target == null || target <= 0) return "text-muted-foreground";
  if (actual >= target) return "text-emerald-700 dark:text-emerald-400";
  return "text-amber-700 dark:text-amber-400";
}

type Props = {
  targetTpvInput: string;
  targetCountInput: string;
  onTargetTpvChange: (v: string) => void;
  onTargetCountChange: (v: string) => void;
  actualTpv: number | null;
  actualTxCount: number | null;
};

export function TransactionTargetsComparison({
  targetTpvInput,
  targetCountInput,
  onTargetTpvChange,
  onTargetCountChange,
  actualTpv,
  actualTxCount,
}: Props) {
  const hasData = actualTpv != null && actualTxCount != null;

  return (
    <Card>
      <CardHeader className="pb-3 space-y-1">
        <CardTitle className="font-outfit text-base">Targets vs actual</CardTitle>
        <CardDescription className="text-xs">
          Enter period targets for the selected date range. Actuals are totals from successful transactions (same as the charts). Targets are stored in
          this browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-target-tpv" className="text-xs">
              TPV target
            </Label>
            <Input
              id="tx-target-tpv"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 5000000"
              value={targetTpvInput}
              onChange={(e) => onTargetTpvChange(e.target.value)}
              className="h-9"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">Total payment volume (currency)</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-target-count" className="text-xs">
              Transaction count target
            </Label>
            <Input
              id="tx-target-count"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1200"
              value={targetCountInput}
              onChange={(e) => onTargetCountChange(e.target.value)}
              className="h-9"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">Successful transactions</p>
          </div>
        </div>

        {hasData ? (
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 px-3 font-medium">Metric</th>
                  <th className="py-2 px-3 font-medium tabular-nums">Actual</th>
                  <th className="py-2 px-3 font-medium tabular-nums">Target</th>
                  <th className="py-2 px-3 font-medium tabular-nums">Variance</th>
                  <th className="py-2 px-3 font-medium tabular-nums">Attainment</th>
                </tr>
              </thead>
              <tbody>
                <TargetRow
                  label="TPV"
                  actual={actualTpv!}
                  targetParsed={parseTargetAmount(targetTpvInput)}
                  formatActual={fmtMoney}
                  formatTarget={(n) => fmtMoney(n)}
                  formatVariance={(a, t) => fmtMoney(a - t)}
                />
                <TargetRow
                  label="Transactions"
                  actual={actualTxCount!}
                  targetParsed={parseTargetCount(targetCountInput)}
                  formatActual={(n) => n.toLocaleString()}
                  formatTarget={(n) => n.toLocaleString()}
                  formatVariance={(a, t) => (a - t).toLocaleString()}
                />
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Load data with Apply to see actuals and compare to targets.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TargetRow({
  label,
  actual,
  targetParsed,
  formatActual,
  formatTarget,
  formatVariance,
}: {
  label: string;
  actual: number;
  targetParsed: number | null;
  formatActual: (n: number) => string;
  formatTarget: (n: number) => string;
  formatVariance: (a: number, t: number) => string;
}) {
  const t = targetParsed;
  const hasTarget = t != null && t > 0;
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-2.5 px-3 font-medium">{label}</td>
      <td className="py-2.5 px-3 tabular-nums">{formatActual(actual)}</td>
      <td className="py-2.5 px-3 tabular-nums text-muted-foreground">{hasTarget ? formatTarget(t) : "—"}</td>
      <td className={cn("py-2.5 px-3 tabular-nums", hasTarget ? varianceTone(actual, t) : "text-muted-foreground")}>
        {hasTarget ? formatVariance(actual, t!) : "—"}
      </td>
      <td className="py-2.5 px-3 tabular-nums">{hasTarget ? pctOfTarget(actual, t!) : "—"}</td>
    </tr>
  );
}
