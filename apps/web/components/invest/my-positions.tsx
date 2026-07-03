"use client";

import Image from "next/image";

import { vaults } from "@/lib/vaults";
import { useVaultBalances } from "@/lib/vault-balance.queries";

function fromStroops(raw: string | undefined, decimals: number): number {
  if (!raw) return 0;
  return Number(raw) / 10 ** decimals;
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

/**
 * The connected account's balance across every known DeFindex vault. Vaults
 * with no position — including ones that error (e.g. no trustline yet on an
 * asset the account has never touched, which simulates identically to a
 * zero balance) — render nothing rather than a "failed"/"no position" row,
 * so the list only ever shows real holdings.
 */
export function MyPositions({ stellarAccountId }: { stellarAccountId?: string }) {
  const queries = useVaultBalances(vaults, stellarAccountId);

  if (!stellarAccountId) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect an account to see your positions.
      </p>
    );
  }

  const anyLoading = queries.some((q) => q.isLoading);

  const positions = vaults
    .map((vault, i) => {
      const data = queries[i].data;
      const underlying = fromStroops(data?.underlyingBalance?.[0], vault.decimals);
      const shares = fromStroops(data?.dfTokens, vault.decimals);
      return { vault, underlying, shares, hasPosition: underlying > 0 || shares > 0 };
    })
    .filter((p) => p.hasPosition);

  if (positions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {anyLoading ? "Loading positions…" : "No positions yet."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {positions.map(({ vault, underlying, shares }) => (
        <li
          key={vault.address}
          className="cl-card cl-reveal flex items-center gap-4 p-4"
        >
          <Image
            src={vault.logo}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{vault.name}</span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {vault.asset} · {vault.network}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-sm font-medium tabular-nums">
              {formatAmount(underlying)} {vault.asset}
            </span>
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              {formatAmount(shares)} shares
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
