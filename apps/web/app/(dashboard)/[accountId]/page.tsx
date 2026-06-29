import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cluster/ui";

/** Empty labeled placeholder for a widget another member owns. */
function Slot({
  id,
  owner,
  children,
}: {
  id: string;
  owner: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={id}
      className="border-border text-muted-foreground flex min-h-24 items-center justify-center rounded-lg border border-dashed p-4 text-xs"
    >
      {children} <span className="ml-2 opacity-60">({owner})</span>
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
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Total Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Slot id="slot-total-balance" owner="M3">
              Total balance figure
            </Slot>
            <Slot id="slot-balance-chart" owner="M3">
              Balance chart
            </Slot>
          </CardContent>
        </Card>
        <Slot id="slot-stat-cards" owner="M3">
          Stat cards
        </Slot>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="coins">Coins</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <Slot id="slot-accounts-table" owner="M2">
            Accounts / members table
          </Slot>
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
