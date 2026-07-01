"use client";

import { use, useState } from "react";
import { Check, Copy, ExternalLink, Info } from "lucide-react";

import { Button } from "@cluster/ui";

import { useAccount } from "@/lib/queries";
import { AddressQr } from "@/components/deposit/address-qr";

export default function DepositPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data: account, isLoading } = useAccount(accountId);
  const [copied, setCopied] = useState(false);

  const address = account?.stellarAccountId ?? "";

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          fund
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Deposit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send Stellar assets to this account’s address to fund the treasury.
        </p>
      </div>

      <div className="cl-card flex flex-col items-center gap-6 p-6">
        {isLoading ? (
          <div className="size-[200px] animate-pulse rounded-2xl bg-[var(--surface-2)]" />
        ) : (
          <AddressQr value={address} />
        )}

        <div className="flex w-full flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Account address
          </span>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
            <span className="min-w-0 flex-1 break-all font-mono text-xs">
              {address || "—"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={copy}
              disabled={!address}
              aria-label="Copy address"
              className="shrink-0 hover:bg-[var(--surface-2)]"
            >
              {copied ? (
                <Check className="size-4 text-[var(--signal)]" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2">
            <span className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Stellar
            </span>
            <span className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Mainnet
            </span>
          </div>
          {address && (
            <a
              href={`https://stellar.expert/explorer/public/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--gold)] hover:underline"
            >
              Explorer <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)]/60 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Only send assets on the <span className="text-foreground">Stellar public network</span>.
          For non-native assets, this account must already hold the matching
          trustline or the payment will fail. Deposits are non-reversible.
        </p>
      </div>
    </div>
  );
}
