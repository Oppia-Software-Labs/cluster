"use client";

import type { ReactNode } from "react";
import { Coins, PenLine, ShieldCheck, Users } from "lucide-react";

import { useBalances } from "@/lib/assets.queries";
import { useAccount } from "@/lib/queries";
import { usePendingSignatures } from "@/lib/transactions.queries";

type StatCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

/** Compact metric tile for the Treasury overview sidebar. */
function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="cl-card flex items-center justify-between p-4">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
          {value}
        </span>
      </div>
      <span className="text-muted-foreground">{icon}</span>
    </div>
  );
}

/**
 * Key account metrics: members, medium signing threshold, pending approvals,
 * and trustline count.
 */
export function StatCards({ accountId }: { accountId: string }) {
  const { data: account, isLoading: accountLoading } = useAccount(accountId);
  const { data: balances, isLoading: balancesLoading } =
    useBalances(accountId);
  const { data: pending, isLoading: pendingLoading } = usePendingSignatures();

  const isLoading = accountLoading || balancesLoading || pendingLoading;

  if (isLoading) {
    return (
      <div
        data-testid="slot-stat-cards"
        className="flex min-h-40 flex-col gap-3"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]/60"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  const memberCount = account?.members.length ?? 0;
  const totalWeight =
    account?.members.reduce((sum, m) => sum + m.weight, 0) ?? 0;
  const mediumThreshold = account?.thresholds.medium ?? 0;
  const thresholdLabel =
    totalWeight > 0 ? `${mediumThreshold} of ${totalWeight}` : "—";

  const pendingCount =
    pending?.accounts.find((a) => a.accountId === accountId)?.count ?? 0;
  const assetCount = balances?.balances.length ?? 0;

  return (
    <div
      data-testid="slot-stat-cards"
      className="flex flex-col gap-3"
    >
      <StatCard
        label="Members"
        value={String(memberCount)}
        icon={<Users className="size-4" />}
      />
      <StatCard
        label="Signing threshold"
        value={thresholdLabel}
        icon={<ShieldCheck className="size-4" />}
      />
      <StatCard
        label="Pending approvals"
        value={String(pendingCount)}
        icon={<PenLine className="size-4" />}
      />
      <StatCard
        label="Assets"
        value={String(assetCount)}
        icon={<Coins className="size-4" />}
      />
    </div>
  );
}
