"use client";

import { use } from "react";
import { useHistory } from "@/lib/assets.queries";

export default function HistoryPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const history = useHistory(accountId);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="text-muted-foreground text-sm">
        Recent on-chain payments for this account (Horizon scaffold).
      </p>
      <p className="text-muted-foreground text-xs">
        Hook status: {history.isLoading ? "loading" : history.status}
      </p>
    </section>
  );
}
