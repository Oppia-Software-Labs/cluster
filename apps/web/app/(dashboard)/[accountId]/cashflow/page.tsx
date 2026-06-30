"use client";

import { use } from "react";

export default function CashflowPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Cashflow</h1>
      <p className="text-muted-foreground text-sm">
        Aggregated inflows and outflows for account{" "}
        <span className="font-mono">{accountId}</span> — TODO in a
        later hardening pass.
      </p>
    </section>
  );
}
