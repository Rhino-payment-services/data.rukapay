import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyAnalyticsError } from "@/lib/analytics-errors";
import { cn } from "@/lib/utils";

export { parseAnalyticsErrorDetail } from "@/lib/analytics-errors";

export function AnalyticsErrorAlert({
  message,
  title: titleOverride,
  /** Shown before the friendly title, e.g. "Volume over time" */
  context,
  onRetry,
  retryLabel = "Try again",
  isRetrying,
  className,
}: {
  message: string;
  title?: string;
  context?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  className?: string;
}) {
  const friendly = friendlyAnalyticsError(message);
  const composedTitle = context ? `${context} — ${friendly.title}` : friendly.title;
  const title = titleOverride ?? composedTitle;

  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="text-destructive/90">{friendly.body}</AlertDescription>
        </div>
        {friendly.technical ? (
          <details className="text-xs text-destructive/80 max-w-full">
            <summary className="cursor-pointer select-none font-medium">Technical details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono bg-destructive/5 rounded-md p-2 border border-destructive/20">
              {friendly.technical}
            </pre>
          </details>
        ) : null}
        {onRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry} disabled={isRetrying} className="w-fit">
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                Loading…
              </>
            ) : (
              retryLabel
            )}
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

function ChartSkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 pt-1", className)}>
      <div className="flex items-end gap-2 h-[200px] px-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${28 + ((i * 17) % 55)}%` }} />
        ))}
      </div>
      <div className="flex justify-between px-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

export function OverviewLoadingSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading overview metrics">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="space-y-2 pb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full max-w-[180px]" />
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function TransactionsLoadingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch" aria-busy="true" aria-label="Loading transaction charts">
      {[0, 1].map((k) => (
        <Card key={k} className="flex flex-col overflow-hidden">
          <CardHeader className="py-3 pb-2 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <ChartSkeletonBlock />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function UsersLoadingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading user activity">
      {[0, 1].map((k) => (
        <Card key={k}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full max-w-md" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function WalletChartLoadingSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading wallet growth chart">
      <CardHeader className="pb-2 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[260px] rounded-lg border border-dashed border-border/70 bg-muted/25 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading chart…</p>
          <Skeleton className="h-2 w-48 rounded-full opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MerchantsTableLoadingSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading merchant rankings">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 border-b pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 max-w-[120px]" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="flex gap-4 items-center py-2 border-b border-border/40 last:border-0">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
