import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cluster/ui";

import { AccountsList } from "@/components/accounts/accounts-list";

/** Empty labeled placeholder for a widget another member owns. */
function Slot({
  id,
  owner,
  children,
  className = "",
}: {
  id: string;
  owner: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid={id}
      className={`flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-4 text-center text-xs text-muted-foreground ${className}`}
    >
      <span>
        {children}
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">
          {owner}
        </span>
      </span>
    </div>
  );
}

/**
 * Overview page — Member 1 ships LAYOUT + labeled SLOTS only.
 * Data widgets are owned by other members:
 *   Total Balance / chart / stat cards → M3 (assets)
 *   Accounts/Members/Threshold        → M2
 *   Trade action                      → M4
 * Do NOT implement their data here; compose their widgets into these slots.
 */
export default function OverviewPage() {
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
          <Slot id="slot-total-balance" owner="M3">
            Total balance figure
          </Slot>
          <Slot id="slot-balance-chart" owner="M3" className="min-h-40">
            Balance chart
          </Slot>
        </section>
        <Slot id="slot-stat-cards" owner="M3" className="min-h-40 rounded-2xl">
          Stat cards
        </Slot>
      </div>

      <Tabs defaultValue="accounts" className="gap-4">
        <TabsList className="bg-[var(--surface)]">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="coins">Coins</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          {/* M2 (Point 4): the user's multisig accounts + create flow. */}
          <AccountsList />
        </TabsContent>
        <TabsContent value="coins">
          <Slot id="slot-coins-table" owner="M3">
            Coins table
          </Slot>
        </TabsContent>
        <TabsContent value="nfts">
          <Slot id="slot-nfts-table" owner="M3">
            NFTs table
          </Slot>
        </TabsContent>
      </Tabs>
    </div>
  );
}
