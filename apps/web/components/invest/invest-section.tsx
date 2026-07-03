"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Vault as VaultIcon } from "lucide-react";

import { Badge, Button } from "@cluster/ui";
import { vaults } from "@/lib/vaults";
import { VaultActionDialog } from "@/components/invest/vault-action-dialog";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function VaultCard({
  vault,
  index,
  accountId,
  stellarAccountId,
}: {
  vault: (typeof vaults)[number];
  index: number;
  accountId: string;
  stellarAccountId?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(vault.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <li
      className="cl-card cl-reveal flex flex-col gap-4 p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)]"
            aria-hidden
          >
            <VaultIcon className="size-4 text-[var(--gold)]" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{vault.name}</span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {vault.asset} · {vault.strategy}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="font-mono uppercase">
          {vault.network}
        </Badge>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {truncate(vault.address)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={copy}
          aria-label="Copy vault address"
          className="shrink-0 hover:bg-[var(--surface-2)]"
        >
          {copied ? (
            <Check className="size-4 text-[var(--signal)]" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <a
          href={`https://stellar.expert/explorer/${vault.network}/contract/${vault.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--gold)] hover:underline"
        >
          View on Explorer <ExternalLink className="size-3.5" />
        </a>
        {stellarAccountId && (
          <div className="flex items-center gap-2">
            <VaultActionDialog
              mode="withdraw"
              accountId={accountId}
              stellarAccountId={stellarAccountId}
              vaultAddress={vault.address}
              vaultName={vault.name}
              asset={vault.asset}
            />
            <VaultActionDialog
              mode="deposit"
              accountId={accountId}
              stellarAccountId={stellarAccountId}
              vaultAddress={vault.address}
              vaultName={vault.name}
              asset={vault.asset}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The vaults list + deposit/withdraw actions, shared by the account-scoped
 * `/[accountId]/invest` page and the `/dashboard/invest` shortcut (which
 * auto-resolves the signed-in user's account).
 */
export function InvestSection({
  accountId,
  stellarAccountId,
}: {
  accountId: string;
  stellarAccountId?: string;
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          yield
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Invest
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          DeFindex vaults available on Stellar testnet. Deposits and
          withdrawals are proposed through the multisig pipeline — sign off
          on /activity.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {vaults.map((vault, i) => (
          <VaultCard
            key={vault.address}
            vault={vault}
            index={i}
            accountId={accountId}
            stellarAccountId={stellarAccountId}
          />
        ))}
      </ul>
    </section>
  );
}
