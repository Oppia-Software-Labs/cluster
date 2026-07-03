"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Hourglass,
  Loader2,
  LockKeyhole,
  Send,
} from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import { Button, Input } from "@cluster/ui";

import { TestnetBanner } from "@/components/confidential/testnet-banner";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { apiError } from "@/lib/api-error";
import {
  proposeTransferTx,
  stroopsToXlm,
  useConfidentialRegistration,
  useConfidentialSession,
  useConfidentialSync,
  xlmToStroops,
} from "@/lib/confidential";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export default function ConfidentialTransferPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: registration, isSuccess: regReady } =
    useConfidentialRegistration(accountId);
  const session = useConfidentialSession(accountId);
  const sync = useConfidentialSync(
    accountId,
    session.status === "unlocked" ? session.sk : null,
  );
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recipientValid = StrKey.isValidEd25519PublicKey(recipient.trim());

  let amountValid = false;
  let amountStroops = BigInt(0);
  try {
    if (amount.trim()) {
      amountStroops = xlmToStroops(amount);
      amountValid = amountStroops > BigInt(0);
    }
  } catch {
    amountValid = false;
  }

  const spendable = sync.data?.spendable.v ?? BigInt(0);
  const exceedsSpendable = amountValid && amountStroops > spendable;
  const unlocked = session.status === "unlocked" && session.sk != null;

  const canSubmit =
    Boolean(account) &&
    Boolean(registration) &&
    unlocked &&
    Boolean(sync.data) &&
    recipientValid &&
    amountValid &&
    !exceedsSpendable &&
    !busy &&
    !propose.isPending;

  async function submit() {
    if (!account || !registration || !session.sk || !sync.data || !canSubmit)
      return;
    setError(null);
    setBusy(true);
    try {
      const built = await proposeTransferTx({
        account: account.stellarAccountId,
        sk: session.sk,
        spendable: sync.data.spendable,
        recipient: recipient.trim(),
        amountStroops,
        auditorId: registration.auditorId,
      });
      // Memo is public — do not include amount or recipient.
      const { tx } = await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        confidentialOp: built.confidentialOp,
        confidentialPayload: built.confidentialPayload,
        network: "testnet",
        memo: "Confidential transfer",
      });
      setProposed(tx.id);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (regReady && !registration) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential · transfer
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Transfer
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

  if (regReady && registration?.status === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential · transfer
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Transfer
          </h1>
        </div>
        <section className="cl-card flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-[var(--gold)]/30 bg-[var(--surface)]">
            <Hourglass className="size-7 text-[var(--gold)]" />
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Registration pending
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            The register transaction is awaiting signatures. Approve it in
            Activity — once it confirms on-chain, this page unlocks.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-[var(--hairline)] bg-transparent"
          >
            <Link href={`/${accountId}/activity`}>View activity</Link>
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
          Transfer proposed
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Co-signers decrypt and review the amount in Activity before signing.
          Only commitments and a proof go on-chain.
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
          confidential · transfer
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Transfer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Only commitments and a proof go on-chain — the amount stays private.
          Co-signers can decrypt and review it in Activity before signing.
        </p>
      </div>

      <TestnetBanner />

      {!unlocked ? (
        <section className="cl-card flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <LockKeyhole className="size-4 text-[var(--gold)]" />
            Unlock confidential key
          </h2>
          {session.status === "not-provisioned" ? (
            <p className="text-muted-foreground text-sm">
              You don&apos;t hold this account&apos;s confidential key yet. Ask a
              member to grant you access from the Confidential page.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Unlock your session to sync spendable balance and build the
                transfer proof.
              </p>
              <Button
                disabled={session.status === "unlocking"}
                onClick={() => session.unlock()}
                className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
              >
                {session.status === "unlocking" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Unlocking…
                  </>
                ) : (
                  <>
                    <LockKeyhole className="size-4" /> Unlock
                  </>
                )}
              </Button>
            </>
          )}
          {session.error ? (
            <p className="text-destructive text-sm">{session.error}</p>
          ) : null}
        </section>
      ) : sync.isLoading ? (
        <section className="cl-card flex items-center gap-2 p-5 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Syncing confidential state…
        </section>
      ) : !sync.data ? (
        <section className="cl-card p-5">
          <p className="text-destructive text-sm">
            {sync.error instanceof Error
              ? sync.error.message
              : "Could not load spendable balance."}
          </p>
        </section>
      ) : (
        <section className="cl-card flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <Send className="size-4 text-[var(--gold)]" /> Private transfer
          </h2>

          <p className="text-muted-foreground text-xs tabular-nums">
            Spendable: {stroopsToXlm(spendable)} XLM
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Recipient</span>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="G…"
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={recipient.length > 0 && !recipientValid}
            />
          </label>
          {recipient.length > 0 && !recipientValid ? (
            <p className="text-destructive text-xs">
              Not a valid Stellar public key.
            </p>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Amount (XLM)</span>
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
          {amount.length > 0 && !amountValid ? (
            <p className="text-destructive text-xs">
              Enter a valid XLM amount greater than zero.
            </p>
          ) : null}
          {exceedsSpendable ? (
            <p className="text-destructive text-xs">
              Exceeds spendable balance ({stroopsToXlm(spendable)} XLM).
            </p>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button
            disabled={!canSubmit}
            onClick={submit}
            className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {busy || propose.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Proving &amp;
                proposing…
              </>
            ) : (
              <>
                <Send className="size-4" /> Propose transfer
              </>
            )}
          </Button>
        </section>
      )}
    </div>
  );
}
