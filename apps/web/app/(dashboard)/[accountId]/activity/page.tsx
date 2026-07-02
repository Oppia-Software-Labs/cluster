"use client";

import { use } from "react";

import { useAccount } from "@/lib/queries";
import { useAccountTransactions } from "@/lib/transactions.queries";
import { TransactionCard } from "@/components/transactions/transaction-card";

export default function ActivityPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data, isLoading, error } = useAccountTransactions(accountId);
  // Members are needed for signature weight math and to gate the Sign action.
  const { data: account } = useAccount(accountId);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          pipeline
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Activity
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pending and in-progress multisig transactions for this account. Sign
          with your wallet — the transaction is submitted on-chain
          automatically once the threshold is met.
        </p>
      </div>
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
        <ul className="flex flex-col gap-3">
          {data.map((tx) => (
            <TransactionCard
              key={tx.id}
              tx={tx}
              members={account?.members ?? []}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
