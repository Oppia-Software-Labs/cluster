"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { NETWORK_LABEL } from "@/lib/stellar-network";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/**
 * The connected-wallet control shown wherever the session appears (dashboard
 * topbar, accounts header). Click opens a dropdown with the network, a copy
 * action and a disconnect action. Renders nothing when signed out.
 */
export function WalletMenu() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  async function copy() {
    if (!user) return;
    await navigator.clipboard.writeText(user.publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-[var(--surface-2)]"
        >
          <Wallet className="size-3.5 text-muted-foreground" />
          {truncate(user.publicKey)}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-[var(--hairline)] shadow-none"
      >
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Network
          </span>
          <span className="text-xs font-medium">Stellar - {NETWORK_LABEL}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
            {user.publicKey}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void copy();
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy address"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="size-4" /> Disconnect wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
