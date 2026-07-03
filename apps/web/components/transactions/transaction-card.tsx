"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, PenLine, Send } from "lucide-react";

import { Badge, Button, cn } from "@cluster/ui";
import type {
  AccountMember,
  Transaction,
  TransactionStatus,
} from "@cluster/shared";
import {
  accumulatedWeight,
  NETWORK_PASSPHRASE,
  TESTNET_NETWORK_PASSPHRASE,
} from "@cluster/stellar";

import { useAuth } from "@/lib/auth";
import {
  useAddSignature,
  useSubmitTransaction,
  useTransaction,
} from "@/lib/transactions.queries";
import { signWithWallet } from "@/lib/transactions/sign";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

const STATUS_STYLE: Record<TransactionStatus, string> = {
  pending: "border-[var(--hairline)] bg-[var(--surface-2)] text-foreground",
  ready: "border-transparent bg-[var(--gold)]/15 text-[var(--gold)]",
  submitted: "border-transparent bg-[var(--signal)]/15 text-[var(--signal)]",
  failed: "border-transparent bg-destructive/15 text-destructive",
};

/**
 * One pending-pipeline transaction: signature progress plus the sign/submit
 * actions. Signing routes through the connected wallet (`signWithWallet`) and
 * posts the extracted raw signature; submitting asks the API to combine the
 * collected signatures and broadcast on-chain.
 */
export function TransactionCard({
  tx,
  members,
}: {
  tx: Transaction;
  members: AccountMember[];
}) {
  const { user } = useAuth();
  const { data: detail } = useTransaction(tx.id);
  const addSignature = useAddSignature(tx.id, tx.accountId);
  const submit = useSubmitTransaction(tx.id, tx.accountId);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const signatures = detail?.signatures ?? [];
  const weights = Object.fromEntries(members.map((m) => [m.publicKey, m.weight]));
  const collectedWeight = accumulatedWeight(
    signatures.map((s) => ({
      signerPublicKey: s.signerPublicKey,
      signatureXdr: s.signatureXdr,
    })),
    weights,
  );
  const pct =
    tx.requiredThreshold > 0
      ? Math.min(100, (collectedWeight / tx.requiredThreshold) * 100)
      : 100;

  const isMember = members.some((m) => m.publicKey === user?.publicKey);
  const hasSigned = signatures.some(
    (s) => s.signerPublicKey === user?.publicKey,
  );
  const canSign = isMember && !hasSigned && tx.status === "pending" && !signing;
  // Submission is automatic once the threshold is met; "ready" only survives
  // when that auto-submission hit a transient error, so offer a manual retry.
  // "failed" envelopes are spent on-chain and can only be proposed again.
  const canRetrySubmit = tx.status === "ready" && !submit.isPending;

  async function sign() {
    if (!user) return;
    setError(null);
    setSigning(true);
    try {
      const passphrase =
        tx.network === "testnet" ? TESTNET_NETWORK_PASSPHRASE : NETWORK_PASSPHRASE;
      const signatureXdr = await signWithWallet(tx.xdr, user.publicKey, passphrase);
      await addSignature.mutateAsync({
        signerPublicKey: user.publicKey,
        signatureXdr,
      });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSigning(false);
    }
  }

  async function submitOnChain() {
    setError(null);
    try {
      await submit.mutateAsync();
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <li className="cl-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium capitalize">{tx.type}</span>
        <Badge className={cn("text-[10px] capitalize", STATUS_STYLE[tx.status])}>
          {tx.status}
        </Badge>
        {tx.memo && (
          <span className="text-muted-foreground truncate text-xs">
            {tx.memo}
          </span>
        )}
        <span className="text-muted-foreground ml-auto font-mono text-[11px]">
          proposed by {truncate(tx.proposedBy)}
        </span>
      </div>

      {/* Signature progress */}
      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center justify-between font-mono text-[11px] tabular-nums">
          <span>signatures</span>
          <span>
            {collectedWeight} / {tx.requiredThreshold} weight
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {signatures.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {signatures.map((s) => (
              <span
                key={s.id}
                className="text-muted-foreground flex items-center gap-1 rounded-md border border-[var(--hairline)] px-1.5 py-0.5 font-mono text-[10px]"
              >
                <CheckCircle2 className="size-3 text-[var(--signal)]" />
                {truncate(s.signerPublicKey)} · w{s.weight}
              </span>
            ))}
          </div>
        )}
      </div>

      {tx.submittedHash && (
        <a
          href={`https://stellar.expert/explorer/${tx.network === "testnet" ? "testnet" : "public"}/tx/${tx.submittedHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-[11px] text-[var(--gold)] hover:underline"
        >
          <ExternalLink className="size-3" />
          {truncate(tx.submittedHash)} on stellar.expert
        </a>
      )}

      {tx.status === "failed" && (
        <p className="text-destructive text-sm">
          {tx.lastError ??
            "This transaction failed on-chain."}{" "}
          <span className="text-muted-foreground">
            The envelope is spent — propose it again.
          </span>
        </p>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {(tx.status === "pending" || tx.status === "ready") && (
        <div className="flex gap-2">
          {isMember && tx.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canSign}
              onClick={sign}
              className="border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]"
            >
              {signing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing…
                </>
              ) : hasSigned ? (
                <>
                  <CheckCircle2 className="size-4" /> Signed — awaiting others
                </>
              ) : (
                <>
                  <PenLine className="size-4" /> Sign
                </>
              )}
            </Button>
          )}
          {canRetrySubmit && (
            <Button
              size="sm"
              onClick={submitOnChain}
              disabled={submit.isPending}
              className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
            >
              {submit.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Retry submission
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
