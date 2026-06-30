"use client";

import { use } from "react";
import { useBalances } from "@/lib/assets.queries";

export default function CoinsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data, isLoading, error } = useBalances(accountId);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Coins</h1>
      <p className="text-muted-foreground text-sm">
        Native XLM and classic trustline balances.
      </p>
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading balances…</p>
      )}
      {error && (
        <p className="text-destructive text-sm">Failed to load balances.</p>
      )}
      {data && data.balances.length === 0 && (
        <p className="text-muted-foreground text-sm">No balances found.</p>
      )}
      {data && data.balances.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.balances.map((balance) => (
            <li
              key={`${balance.assetCode}:${balance.assetIssuer ?? "native"}`}
              className="border-border flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">
                {balance.assetCode}
                {balance.assetIssuer ? (
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {balance.assetIssuer.slice(0, 8)}…
                  </span>
                ) : null}
              </span>
              <span className="font-mono">{balance.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
