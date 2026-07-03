"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, Check, Copy, ExternalLink, PiggyBank } from "lucide-react";

import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@cluster/ui";
import { vaults } from "@/lib/vaults";
import { explorerUrl } from "@/lib/stellar-network";
import { MyPositions } from "@/components/invest/my-positions";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function VaultCard({
  vault,
  index,
  basePath,
  canAct,
}: {
  vault: (typeof vaults)[number];
  index: number;
  basePath: string;
  canAct: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(vault.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <li
      className="cl-reveal overflow-hidden rounded-2xl border border-[var(--hairline)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Light header block — the logo, name and category live here. */}
      <div className="flex items-center justify-between gap-4 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-black/10 bg-white shadow-sm">
            <Image src={vault.logo} alt="" width={28} height={28} className="object-contain" />
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-bold text-black">{vault.name}</span>
            <span className="w-fit rounded-full border border-black/15 px-2.5 py-0.5 text-xs font-medium text-black">
              Lending
            </span>
          </div>
        </div>
        <Image
          src={vault.logo}
          alt=""
          width={96}
          height={96}
          className="shrink-0 object-contain opacity-90"
        />
      </div>

      {/* Dark body — supply info, testnet id, actions. */}
      <div className="flex flex-col gap-4 bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Supply</span>
            <Image src={vault.logo} alt="" width={16} height={16} className="object-contain" />
            <span className="font-medium">{vault.asset}</span>
            <span className="text-muted-foreground">on</span>
            <Badge variant="outline" className="font-mono uppercase">
              {vault.network}
            </Badge>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {truncate(vault.address)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={copy}
              aria-label="Copy vault address"
              className="size-7 shrink-0 hover:bg-[var(--surface)]"
            >
              {copied ? (
                <Check className="size-3.5 text-[var(--signal)]" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <a
              href={explorerUrl(`contract/${vault.address}`, vault.network)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on Explorer"
              className="text-muted-foreground shrink-0 hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        {canAct && (
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="flex-1 justify-center rounded-full bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
            >
              <Link href={`${basePath}/${vault.address}?action=deposit`}>
                <PiggyBank className="size-4" /> Deposit
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="flex-1 justify-center rounded-full border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]"
            >
              <Link href={`${basePath}/${vault.address}?action=withdraw`}>
                <ArrowDownToLine className="size-4" /> Withdraw
              </Link>
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The vaults list + deposit/withdraw actions, shared by the account-scoped
 * `/[accountId]/invest` page and the `/dashboard/invest` shortcut (which
 * auto-resolves the signed-in user's account). Deposit/Withdraw navigate to
 * `${basePath}/${vaultAddress}` (VaultDetail) rather than opening a dialog.
 */
export function InvestSection({
  accountId,
  stellarAccountId,
  basePath,
}: {
  accountId: string;
  stellarAccountId?: string;
  basePath: string;
}) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          yield
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Invest
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          DeFindex vaults — each card shows the Stellar network it lives
          on. Deposits and withdrawals are proposed through the multisig
          pipeline — sign off on /activity.
        </p>
      </div>

      <Tabs defaultValue="vaults" className="gap-4">
        <TabsList className="bg-[var(--surface)]">
          <TabsTrigger value="vaults">Vaults</TabsTrigger>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="vaults">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vaults.map((vault, i) => (
              <VaultCard
                key={vault.address}
                vault={vault}
                index={i}
                basePath={basePath}
                canAct={Boolean(accountId && stellarAccountId)}
              />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="positions">
          <MyPositions stellarAccountId={stellarAccountId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
