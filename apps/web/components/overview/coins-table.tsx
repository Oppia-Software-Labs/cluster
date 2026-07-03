"use client";

import Image from "next/image";
import { Coins } from "lucide-react";

import { useBalances } from "@/lib/assets.queries";
import { vaults } from "@/lib/vaults";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/** "native" rows are XLM; issued assets keep their code. */
const codeOf = (b: { assetCode: string; assetIssuer: string | null }) =>
  b.assetIssuer ? b.assetCode : "XLM";

/** Reuse the vault logos for assets that have one (XLM/USDC/CETES). */
function logoFor(code: string): string | undefined {
  return vaults.find((v) => v.asset === code)?.logo;
}

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

/**
 * Compact trustline list for the overview Coins tab — same row shape as the
 * dedicated Coins page, without the page chrome.
 */
export function CoinsTable({ accountId }: { accountId: string }) {
  const { data, isLoading, error } = useBalances(accountId);

  if (isLoading) {
    return (
      <div data-testid="slot-coins-table" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]/60"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p
        data-testid="slot-coins-table"
        className="text-destructive text-sm"
      >
        Failed to load balances.
      </p>
    );
  }

  if (!data || data.balances.length === 0) {
    return (
      <div
        data-testid="slot-coins-table"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-10 text-center"
      >
        <Coins className="text-muted-foreground size-6" />
        <p className="text-sm font-semibold">No balances yet</p>
        <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
          Fund the account or add a trustline to start holding assets.
        </p>
      </div>
    );
  }

  return (
    <ul data-testid="slot-coins-table" className="flex flex-col gap-2">
      {data.balances.map((balance, i) => {
        const code = codeOf(balance);
        const logo = logoFor(code);
        return (
          <li
            key={`${balance.assetCode}:${balance.assetIssuer ?? "native"}`}
            className="cl-card cl-reveal flex items-center gap-4 p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {logo ? (
              <Image
                src={logo}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 object-contain"
              />
            ) : (
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] font-[family-name:var(--font-display)] text-xs font-bold text-[var(--gold)]"
                aria-hidden
              >
                {code.slice(0, 3)}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{code}</span>
              <span className="text-muted-foreground truncate font-mono text-[11px]">
                {balance.assetIssuer
                  ? truncate(balance.assetIssuer)
                  : "Native"}
              </span>
            </div>
            <span className="font-mono text-sm font-medium tabular-nums">
              {formatAmount(balance.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
