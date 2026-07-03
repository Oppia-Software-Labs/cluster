"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, CheckCircle2, Loader2 } from "lucide-react";
import { Button, Input } from "@cluster/ui";

import { TestnetBanner } from "@/components/confidential/testnet-banner";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { apiError } from "@/lib/api-error";
import {
  proposeDepositTx,
  useConfidentialRegistration,
  xlmToStroops,
} from "@/lib/confidential";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export default function ConfidentialDepositPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: registration, isSuccess: regReady } =
    useConfidentialRegistration(accountId);
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);

  let amountValid = false;
  try {
    if (amount.trim()) {
      const stroops = xlmToStroops(amount);
      amountValid = stroops > BigInt(0);
    }
  } catch {
    amountValid = false;
  }

  const canSubmit =
    Boolean(account) &&
    Boolean(registration) &&
    amountValid &&
    !propose.isPending;

  async function submit() {
    if (!account || !amountValid) return;
    setError(null);
    try {
      const amountStroops = xlmToStroops(amount);
      const built = await proposeDepositTx({
        account: account.stellarAccountId,
        amountStroops,
      });
      const { tx } = await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        confidentialOp: built.confidentialOp,
        network: "testnet",
        memo: `Deposit ${amount.trim()} XLM`,
      });
      setProposed(tx.id);
    } catch (e) {
      setError(apiError(e));
    }
  }

  if (regReady && !registration) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential · deposit
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Deposit
          </h1>
        </div>
        <section className="cl-card flex flex-col items-center gap-4 p-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Activate first
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            This account is not registered on the confidential token yet.
          </p>
          <Button
            asChild
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            <Link href={`/${accountId}/confidential/activate`}>
              Activate confidential
            </Link>
          </Button>
        </section>
      </div>
    );
  }

  if (proposed) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
          <CheckCircle2 className="size-7 text-[var(--signal)]" />
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Deposit proposed
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Co-signers approve the deposit in Activity. Once the threshold is met,
          the amount moves into your confidential balance.
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          tx {truncate(proposed)}
        </p>
        <Button
          asChild
          className="mt-2 bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          <Link href={`/${accountId}/activity`}>View activity</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          confidential · deposit
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Deposit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Move XLM from this account&apos;s classic balance into the
          confidential token.
        </p>
      </div>

      <TestnetBanner />

      <section className="cl-card flex flex-col gap-4 p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <ArrowDownToLine className="size-4 text-[var(--gold)]" /> Amount
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">XLM</span>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            spellCheck={false}
            className="font-mono tabular-nums"
            aria-invalid={amount.length > 0 && !amountValid}
          />
        </label>
        <p className="text-muted-foreground text-xs">
          Deposits are public: this amount is visible on-chain — it funds your
          confidential balance.
        </p>

        {amount.length > 0 && !amountValid ? (
          <p className="text-destructive text-xs">
            Enter a valid XLM amount greater than zero.
          </p>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Button
          disabled={!canSubmit}
          onClick={submit}
          className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          {propose.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Proposing…
            </>
          ) : (
            <>
              <ArrowDownToLine className="size-4" /> Propose deposit
            </>
          )}
        </Button>
      </section>
    </div>
  );
}
