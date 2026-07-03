"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { buildRemoveMemberXdr } from "@/lib/transactions/build-config";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/**
 * Remove-signer control: icon button that opens a confirmation dialog.
 * Confirming proposes the on-chain weight-0 set_options transaction through
 * the signing pipeline; the API drops the off-chain record only once the
 * transaction is submitted on-chain (the member keeps signing power — on both
 * sides — until then, matching what the chain enforces).
 */
export function RemoveMemberButton({
  accountId,
  stellarAccountId,
  memberKey,
}: {
  accountId: string;
  stellarAccountId: string;
  memberKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const propose = useProposeAndSign(accountId, user?.publicKey);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      // Build the on-chain envelope and propose it into the pipeline; the API
      // defers the roster removal until the transaction submits on-chain.
      const built = await buildRemoveMemberXdr(stellarAccountId, memberKey);
      await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        memo: `Remove signer ${truncate(memberKey)}`,
        pendingChange: { kind: "member.remove", publicKey: memberKey },
      });
      setOpen(false);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${truncate(memberKey)}`}
          className="text-muted-foreground size-8 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove signer?</DialogTitle>
          <DialogDescription>
            This proposes an on-chain change removing{" "}
            <span className="font-mono">{truncate(memberKey)}</span> as a
            signer. It takes effect once the other signers approve and it is
            submitted on-chain.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            className="border-[var(--hairline)] bg-transparent"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Removing…
              </>
            ) : (
              "Remove"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
