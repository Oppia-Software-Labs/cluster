"use client";

import type { HistoryRecord } from "@cluster/shared";

import { useBalances, useHistory } from "@/lib/assets.queries";
import { useAccount } from "@/lib/queries";

/** Native XLM payments and account-create credits that move the XLM balance. */
function isNativeXlmRecord(record: HistoryRecord): boolean {
  if (record.assetCode && record.assetCode !== "XLM") return false;
  if (record.type !== "payment" && record.type !== "create_account") return false;
  return !record.assetCode || record.assetCode === "XLM";
}

type ChartPoint = { t: number; v: number };

/**
 * Derive a cumulative native XLM balance series by walking history backward
 * from the current snapshot balance.
 */
function buildBalanceSeries(
  records: HistoryRecord[],
  currentBalance: number,
  stellarAccountId: string,
): ChartPoint[] {
  const relevant = records
    .filter(isNativeXlmRecord)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  let balance = currentBalance;
  const points: ChartPoint[] = [{ t: Date.now(), v: balance }];

  for (let i = relevant.length - 1; i >= 0; i--) {
    const record = relevant[i];
    points.unshift({ t: new Date(record.createdAt).getTime(), v: balance });
    const amount = Number(record.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const received = record.to === stellarAccountId;
    balance = received ? balance - amount : balance + amount;
  }

  return points;
}

/** Inline SVG area sparkline for native XLM balance over time. */
function Sparkline({ points }: { points: ChartPoint[] }) {
  const width = 400;
  const height = 160;
  const padding = 4;

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x =
      padding +
      (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y =
      padding +
      (1 - (p.v - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="balance-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#balance-chart-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r="4"
        fill="var(--gold)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Cumulative native XLM balance sparkline built from Horizon payment history
 * and the current balances snapshot.
 */
export function BalanceChart({ accountId }: { accountId: string }) {
  const { data: history, isLoading: historyLoading } = useHistory(accountId);
  const { data: account, isLoading: accountLoading } = useAccount(accountId);
  const { data: balances, isLoading: balancesLoading } = useBalances(accountId);

  const isLoading = historyLoading || accountLoading || balancesLoading;

  if (isLoading) {
    return (
      <div
        data-testid="slot-balance-chart"
        className="flex min-h-40 items-center justify-center"
      >
        <div className="h-40 w-full animate-pulse rounded-lg bg-[var(--surface)]/60" />
      </div>
    );
  }

  const stellarAccountId = account?.stellarAccountId;
  const native = balances?.balances.find((b) => b.assetIssuer === null);
  const currentBalance = Number(native?.amount ?? 0);

  if (!stellarAccountId || !Number.isFinite(currentBalance)) {
    return (
      <div
        data-testid="slot-balance-chart"
        className="flex min-h-40 items-center justify-center"
      >
        <p className="text-muted-foreground text-xs">Not enough history yet</p>
      </div>
    );
  }

  const records = history?.records ?? [];
  const points = buildBalanceSeries(
    records,
    currentBalance,
    stellarAccountId,
  );

  if (points.length < 2) {
    return (
      <div
        data-testid="slot-balance-chart"
        className="relative flex min-h-40 items-center justify-center"
      >
        <Sparkline
          points={[
            { t: 0, v: currentBalance },
            { t: 1, v: currentBalance },
          ]}
        />
        <p className="text-muted-foreground absolute text-xs">
          Not enough history yet
        </p>
      </div>
    );
  }

  return (
    <div data-testid="slot-balance-chart" className="min-h-40">
      <Sparkline points={points} />
    </div>
  );
}
