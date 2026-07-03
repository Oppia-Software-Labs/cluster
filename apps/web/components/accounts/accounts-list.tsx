"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Plus } from "lucide-react";

import { Badge, Button, cn } from "@cluster/ui";
import { useAccounts } from "@/lib/queries";
import { CreateAccountDialog } from "./create-account-dialog";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const initials = (name: string) => name.slice(0, 2).toUpperCase();

/** Inline copy control for a multisig address; stops the parent link/navigation. */
function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy account address"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(address);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

/**
 * The signed-in user's multisig accounts: a clickable list, an empty-state CTA,
 * and a "new account" action. Used by the /accounts landing and the overview
 * Accounts tab. `activeAccountId` highlights the current account when rendered
 * inside a specific account's dashboard.
 */
export function AccountsList({ activeAccountId }: { activeAccountId?: string }) {
  const { data: accounts, isLoading, isError, error } = useAccounts();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]/60"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Couldn’t load accounts:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="cl-reveal flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-10 text-center">
        <p className="text-sm font-semibold">No multisig accounts yet</p>
        <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
          Create your first multisig to manage assets together, with signing
          rules enforced on-chain.
        </p>
        <CreateAccountDialog
          trigger={
            <Button className="mt-1">
              <Plus className="size-4" /> Create your first multisig
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((account, i) => {
        const active =
          account.stellarAccountId === activeAccountId ||
          account.id === activeAccountId;
        return (
          <div
            key={account.id}
            className={cn(
              "cl-card cl-reveal group flex items-center gap-3 p-4",
              active && "border-white/40",
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Link
              href={`/${account.stellarAccountId}`}
              className="flex min-w-0 flex-1 items-center gap-4"
            >
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] font-[family-name:var(--font-display)] text-sm font-bold"
                aria-hidden
              >
                {initials(account.name)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {account.name}
                </span>
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {truncate(account.stellarAccountId)}
                </span>
              </div>
            </Link>
            {active && (
              <Badge className="border-transparent bg-white/10 text-[10px] text-foreground">
                current
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-[var(--hairline)] font-mono text-[10px] text-muted-foreground"
            >
              H {account.thresholds.high}
            </Badge>
            <CopyAddress address={account.stellarAccountId} />
            <Link
              href={`/${account.stellarAccountId}`}
              aria-label={`Open ${account.name}`}
              className="grid size-8 place-items-center text-muted-foreground"
            >
              <ArrowUpRight className="size-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          </div>
        );
      })}
      <div className="pt-1">
        <CreateAccountDialog
          trigger={
            <Button
              variant="outline"
              className="w-full border-dashed border-[var(--hairline)] bg-transparent text-muted-foreground hover:border-[var(--gold)]/40 hover:bg-[var(--surface)] hover:text-foreground"
            >
              <Plus className="size-4" /> New account
            </Button>
          }
        />
      </div>
    </div>
  );
}
