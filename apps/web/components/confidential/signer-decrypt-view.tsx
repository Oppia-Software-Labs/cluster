"use client";

import { useMemo } from "react";
import { Eye, Loader2, LockKeyhole } from "lucide-react";

import { Button, cn } from "@cluster/ui";
import type { Transaction } from "@cluster/shared";

import {
  decryptProposedTransfer,
} from "@/lib/confidential";
import {
  getSessionKStore,
  useConfidentialSession,
} from "@/lib/confidential/session";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/**
 * Lets a multisig co-signer review the decrypted amount of a proposed
 * confidential transfer before signing.
 */
export function SignerDecryptView({ tx }: { tx: Transaction }) {
  const session = useConfidentialSession(tx.accountId);

  const detail = useMemo(() => {
    if (
      session.status !== "unlocked" ||
      !tx.confidentialPayload ||
      tx.confidentialOp !== "transfer"
    ) {
      return null;
    }
    const kStore = getSessionKStore(tx.accountId);
    if (!kStore) return null;
    return decryptProposedTransfer(tx.confidentialPayload, kStore);
  }, [tx.confidentialPayload, tx.confidentialOp, tx.accountId, session.status]);

  if (tx.confidentialOp !== "transfer" || !tx.confidentialPayload) {
    return null;
  }

  if (session.status === "not-provisioned") {
    return (
      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-2)] p-3 text-sm">
        <p className="text-muted-foreground">
          You don&apos;t hold this account&apos;s confidential key yet. Ask a
          member to grant you access from the Confidential page.
        </p>
      </div>
    );
  }

  if (session.status === "unlocked") {
    return (
      <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3">
        <div className="flex items-center gap-1.5">
          <Eye className="size-3.5 text-[var(--gold)]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential detail
          </p>
        </div>
        {detail ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xl font-semibold tabular-nums">
              {detail.amount}
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                XLM
              </span>
            </span>
            <span className="text-muted-foreground font-mono text-sm">
              → {truncate(detail.recipient)}
            </span>
          </div>
        ) : (
          <p className="text-destructive mt-2 text-sm">
            Could not decrypt this transfer with your key.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3">
      <div className="flex items-start gap-2">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            Amounts are encrypted. Unlock to review this transfer before signing.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={session.status === "unlocking"}
            onClick={() => session.unlock()}
            className={cn(
              "w-fit border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]",
            )}
          >
            {session.status === "unlocking" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Unlocking…
              </>
            ) : (
              "Unlock"
            )}
          </Button>
          {session.error && (
            <p className="text-destructive text-xs">{session.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
