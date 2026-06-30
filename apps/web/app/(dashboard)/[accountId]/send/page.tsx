"use client";

import { use } from "react";
import { useProposeTransaction } from "@/lib/transactions.queries";

export default function SendPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const propose = useProposeTransaction(accountId);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Send</h1>
      <p className="text-muted-foreground text-sm">
        Propose a payment transaction for multisig approval. Full send UI coming
        in a later pass.
      </p>
      <p className="text-muted-foreground text-xs">
        Pipeline hook ready: propose mutation{" "}
        {propose.isIdle ? "idle" : propose.status}.
      </p>
    </section>
  );
}
