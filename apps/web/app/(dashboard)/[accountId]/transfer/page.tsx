"use client";

import { use } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cluster/ui";
import { SendPanel } from "@/components/transfer/send-panel";
import { ReceivePanel } from "@/components/transfer/receive-panel";

export default function TransferPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          transfer
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Send &amp; Receive
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Propose a payment for the signers to approve, or share this
          account&apos;s address to receive funds.
        </p>
      </div>

      <Tabs defaultValue="send" className="gap-4">
        <TabsList className="bg-[var(--surface)]">
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="receive">Receive</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <SendPanel accountId={accountId} />
        </TabsContent>
        <TabsContent value="receive">
          <ReceivePanel accountId={accountId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
