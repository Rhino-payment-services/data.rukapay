import type { ReactNode } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Overview / KPI tile: title + optional gloss + big number. */
export function KpiCard({ label, sublabel, value }: { label: ReactNode; sublabel?: string; value: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="space-y-0.5">
          <div className="space-y-0.5">
            {label}
            {sublabel ? <span className="block text-[11px] text-muted-foreground font-normal leading-snug">{sublabel}</span> : null}
          </div>
        </CardDescription>
        <CardTitle className="text-2xl font-outfit tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** Table column: abbreviation + gloss (stacked). */
export function ThAbbr({ abbr, full, className }: { abbr: string; full: string; className?: string }) {
  return (
    <th className={cn("py-2 pr-4 align-bottom text-left text-muted-foreground", className)}>
      <div className="text-foreground">
        <abbr title={full} className="cursor-help border-b border-dotted border-muted-foreground/60 no-underline">
          {abbr}
        </abbr>
      </div>
      <div className="text-[10px] font-normal text-muted-foreground max-w-[9rem] leading-tight mt-0.5">{full}</div>
    </th>
  );
}

/** Abbreviation + plain-English gloss on one line, value below (for KPI grids). */
export function MetricAbbrev({
  abbr,
  full,
  value,
  className,
}: {
  abbr: string;
  full: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <abbr title={full} className="text-sm font-semibold text-foreground no-underline cursor-help border-b border-dotted border-muted-foreground/60">
          {abbr}
        </abbr>
        <span className="text-[11px] text-muted-foreground leading-snug">({full})</span>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Compact row for segment cards: “DAU — daily active users: 0” */
export function SegmentMetricLine({
  abbr,
  full,
  value,
}: {
  abbr: string;
  full: string;
  value: ReactNode;
}) {
  return (
    <p className="text-sm">
      <span className="font-medium">
        <abbr title={full} className="no-underline cursor-help border-b border-dotted border-muted-foreground/60">
          {abbr}
        </abbr>
      </span>
      <span className="text-muted-foreground"> — {full}: </span>
      <span className="tabular-nums font-medium">{value}</span>
    </p>
  );
}
