"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";

import { Button, Input, cn } from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useBalances } from "@/lib/assets.queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { buildPaymentXdr, type PaymentDraft } from "@/lib/transactions/build-payment";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export default function SendPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: balancesData } = useBalances(accountId);
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const balances = balancesData?.balances ?? [];
  const [assetIdx, setAssetIdx] = useState(0);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ id: string; signed: boolean } | null>(
    null,
  );

  const selected = balances[assetIdx];
  const destValid = StrKey.isValidEd25519PublicKey(destination.trim());
  const amountNum = Number(amount);
  const balanceNum = selected ? Number(selected.amount) : 0;
  const amountValid =
    amount.length > 0 && amountNum > 0 && amountNum <= balanceNum;
  const canSubmit =
    Boolean(account) && destValid && amountValid && !propose.isPending;

  const assetLabel = useMemo(
    () => (b?: (typeof balances)[number]) =>
      !b ? "" : b.assetIssuer ? b.assetCode : "XLM",
    [balances],
  );

  async function submit() {
    if (!account || !selected) return;
    setError(null);
    try {
      const draft: PaymentDraft = {
        source: account.stellarAccountId,
        destination: destination.trim(),
        asset: selected.assetIssuer
          ? { code: selected.assetCode, issuer: selected.assetIssuer }
          : "native",
        amount: String(amountNum),
        memo: memo.trim() || undefined,
      };
      const built = await buildPaymentXdr(draft);
      const { tx, signed } = await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        memo: draft.memo,
      });
      setProposed({ id: tx.id, signed });
    } catch (e) {
      setError(apiError(e));
    }
  }

  if (proposed) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
          <CheckCircle2 className="size-7 text-[var(--signal)]" />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Payment proposed
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          {proposed.signed
            ? "Signed with your wallet. It is submitted on-chain automatically the moment the required signatures are collected — track it in Activity."
            : "Your wallet didn’t sign it yet — you can sign from the Activity page. It is submitted automatically once enough signatures are collected."}
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          tx {truncate(proposed.id)}
        </p>
        <div className="mt-2 flex gap-3">
          <Button asChild variant="outline" className="border-[var(--hairline)] bg-transparent">
            <Link href={`/${accountId}/activity`}>View activity</Link>
          </Button>
          <Button
            onClick={() => {
              setProposed(null);
              setDestination("");
              setAmount("");
              setMemo("");
            }}
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            Propose another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          transfer
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Send
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Propose a payment for the signers to approve.
        </p>
      </div>

      <div className="cl-card flex flex-col gap-5 p-5">
        {/* Asset */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Asset</span>
          {balances.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No balances found for this account yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {balances.map((b, i) => (
                <button
                  key={`${b.assetCode}-${b.assetIssuer ?? "native"}`}
                  type="button"
                  onClick={() => setAssetIdx(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    i === assetIdx
                      ? "border-[var(--gold)]/60 bg-[var(--surface-2)]"
                      : "border-[var(--hairline)] hover:bg-[var(--surface)]",
                  )}
                >
                  <span className="font-medium">{assetLabel(b)}</span>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    {Number(b.amount).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipient */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Recipient</span>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G…"
            spellCheck={false}
            className="font-mono text-xs"
            aria-invalid={destination.length > 0 && !destValid}
          />
          {destination.length > 0 && !destValid && (
            <span className="text-destructive text-xs">
              Not a valid Stellar public key.
            </span>
          )}
        </label>

        {/* Amount */}
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Amount</span>
            {selected && (
              <button
                type="button"
                onClick={() => setAmount(selected.amount)}
                className="text-[var(--gold)] font-mono text-[11px] hover:underline"
              >
                max {Number(selected.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pr-16 font-mono"
              aria-invalid={amount.length > 0 && !amountValid}
            />
            <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs">
              {assetLabel(selected)}
            </span>
          </div>
          {amount.length > 0 && !amountValid && (
            <span className="text-destructive text-xs">
              Enter an amount up to your available balance.
            </span>
          )}
        </label>

        {/* Memo */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Memo <span className="text-muted-foreground font-normal">(optional)</span>
          </span>
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={28}
            placeholder="Invoice #1024"
          />
        </label>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          disabled={!canSubmit}
          onClick={submit}
          size="lg"
          className="h-11 bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          {propose.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Proposing…
            </>
          ) : (
            <>
              <Send className="size-4" /> Propose payment
            </>
          )}
        </Button>
      </div>

      {account && (
        <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]">
          <ArrowUpRight className="size-3.5" />
          from {truncate(account.stellarAccountId)}
        </p>
      )}
    </div>
  );
}
