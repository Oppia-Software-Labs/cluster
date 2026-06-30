"use client";

import { use } from "react";

export default function DepositPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Deposit</h1>
      <p className="text-muted-foreground text-sm">
        Show the Stellar deposit address for account{" "}
        <span className="font-mono">{accountId}</span>. Funding UI
        coming in a later pass.
      </p>
    </section>
  );
}
