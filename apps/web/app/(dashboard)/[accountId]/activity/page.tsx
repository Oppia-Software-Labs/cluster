"use client";

import { use } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cluster/ui";
import type { Transaction } from "@cluster/shared";
import { useAccount } from "@/lib/queries";
import { useAccountTransactions } from "@/lib/transactions.queries";
import { TransactionCard } from "@/components/transactions/transaction-card";

/**
 * Bucket the four on-chain statuses into the three tabs the sidebar exposes.
 * "pending"/"ready" are both still awaiting action (ready just means the
 * threshold was met and auto-submission is mid-flight or hit a transient
 * error); "failed" envelopes are spent and unrecoverable, i.e. expired.
 */
const STATUS_TABS = {
  pending: (tx: Transaction) => tx.status === "pending" || tx.status === "ready",
  done: (tx: Transaction) => tx.status === "submitted",
  expired: (tx: Transaction) => tx.status === "failed",
} as const;

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

      {data && (
        <Tabs defaultValue="pending" className="gap-4">
          <TabsList className="bg-[var(--surface)]">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>

          {(Object.keys(STATUS_TABS) as (keyof typeof STATUS_TABS)[]).map((tab) => {
            const filtered = data.filter(STATUS_TABS[tab]);
            return (
              <TabsContent key={tab} value={tab}>
                {filtered.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No {tab} transactions.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {filtered.map((tx) => (
                      <TransactionCard
                        key={tx.id}
                        tx={tx}
                        members={account?.members ?? []}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
