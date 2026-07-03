"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Coins } from "lucide-react";

import { Button } from "@cluster/ui";
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

export default function CoinsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data, isLoading, error } = useBalances(accountId);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            assets
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Coins
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Native XLM and classic trustline balances.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          <Link href={`/${accountId}/transfer`}>
            Send <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]/60"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="text-destructive text-sm">Failed to load balances.</p>
      )}
      {data && data.balances.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-10 text-center">
          <Coins className="text-muted-foreground size-6" />
          <p className="text-sm font-semibold">No balances yet</p>
          <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
            Fund the account or add a trustline to start holding assets.
          </p>
        </div>
      )}
      {data && data.balances.length > 0 && (
        <ul className="flex flex-col gap-2">
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
                      ? `issued by ${truncate(balance.assetIssuer)}`
                      : "Stellar Lumens · native"}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-sm font-medium tabular-nums">
                    {formatAmount(balance.amount)}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                    {code}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data && (
        <p className="text-muted-foreground font-mono text-[11px]">
          snapshot {new Date(data.capturedAt).toLocaleTimeString()}
        </p>
      )}
    </section>
  );
}
