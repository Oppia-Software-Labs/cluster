"use client";

import { use } from "react";
import { useAccountTransactions } from "@/lib/transactions.queries";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data, isLoading, error } = useAccountTransactions(accountId);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <p className="text-muted-foreground text-sm">
        Pending and in-progress multisig transactions for this account.
      </p>
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading transactions…</p>
      )}
      {error && (
        <p className="text-destructive text-sm">Failed to load transactions.</p>
      )}
      {data && data.length === 0 && (
        <p className="text-muted-foreground text-sm">No transactions yet.</p>
      )}
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((tx) => (
            <li
              key={tx.id}
              className="border-border rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">{tx.type}</span> · {tx.status} ·
              threshold {tx.requiredThreshold}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
