"use client";

import { use } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cluster/ui";

import { AccountsList } from "@/components/accounts/accounts-list";
import { BalanceChart } from "@/components/overview/balance-chart";
import { CoinsTable } from "@/components/overview/coins-table";
import { StatCards } from "@/components/overview/stat-cards";
import { TotalBalance } from "@/components/overview/total-balance";

export default function OverviewPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          overview
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Treasury
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="cl-card flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Total balance</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              all assets
            </span>
          </div>
          <TotalBalance accountId={accountId} />
          <BalanceChart accountId={accountId} />
        </section>
        <StatCards accountId={accountId} />
      </div>

      <Tabs defaultValue="accounts" className="gap-4">
        <TabsList className="bg-[var(--surface)]">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="coins">Coins</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <AccountsList />
        </TabsContent>
        <TabsContent value="coins">
          <CoinsTable accountId={accountId} />
        </TabsContent>
        <TabsContent value="nfts">
          <div
            data-testid="slot-nfts-table"
            className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-8 text-center"
          >
            <p className="text-muted-foreground text-sm">
              No NFTs found for this account.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
