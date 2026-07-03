"use client";

import { useBalances } from "@/lib/assets.queries";

/** Format a Horizon decimal string with up to 7 fractional digits, trimmed. */
function formatNativeAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const fixed = n.toFixed(7);
  return fixed.replace(/\.?0+$/, "") || "0";
}

/**
 * Hero native XLM balance for the Treasury overview, with a trustline count
 * and snapshot timestamp from the balances endpoint.
 */
export function TotalBalance({ accountId }: { accountId: string }) {
  const { data, isLoading, error } = useBalances(accountId);

  if (isLoading) {
    return (
      <div data-testid="slot-total-balance" className="flex flex-col gap-2">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--surface)]/80" />
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface)]/60" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        data-testid="slot-total-balance"
        className="text-muted-foreground text-sm"
      >
        Balances unavailable
      </p>
    );
  }

  const native = data?.balances.find((b) => b.assetIssuer === null);
  const otherCount =
    data?.balances.filter((b) => b.assetIssuer !== null).length ?? 0;
  const amount = native ? formatNativeAmount(native.amount) : "0";

  return (
    <div data-testid="slot-total-balance" className="flex flex-col gap-1">
      <p className="font-[family-name:var(--font-display)] text-4xl font-bold tabular-nums">
        {amount}
        <span className="text-muted-foreground text-2xl font-medium"> XLM</span>
      </p>
      {otherCount > 0 && (
        <p className="text-muted-foreground text-sm">
          + {otherCount} other asset{otherCount === 1 ? "" : "s"}
        </p>
      )}
      {data?.capturedAt && (
        <p className="text-muted-foreground font-mono text-[10px]">
          as of {new Date(data.capturedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
