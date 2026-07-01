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

import { useRemoveMember } from "@/lib/queries";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/** Remove-signer control: icon button that opens a confirmation dialog. */
export function RemoveMemberButton({
  accountId,
  memberId,
  memberKey,
}: {
  accountId: string;
  memberId: string;
  memberKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useRemoveMember(accountId);

  async function confirm() {
    setError(null);
    try {
      await remove.mutateAsync(memberId);
      setOpen(false);
    } catch (e) {
      setError(apiError(e));
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
            <span className="font-mono">{truncate(memberKey)}</span> will lose
            signing power on this account. You can add them back later.
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
            disabled={remove.isPending}
            onClick={confirm}
          >
            {remove.isPending ? (
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
