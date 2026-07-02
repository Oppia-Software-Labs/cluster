"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  cn,
} from "@cluster/ui";
import type { MemberRole } from "@cluster/shared";

import { useAuth } from "@/lib/auth";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { buildAddMemberXdr } from "@/lib/transactions/build-config";
import { apiError } from "@/lib/api-error";

const ASSIGNABLE_ROLES: { value: MemberRole; label: string; help: string }[] = [
  { value: "member", label: "Member", help: "Signs transactions." },
  { value: "admin", label: "Admin", help: "Signs + manages the account." },
];

/**
 * Add-signer dialog. Validates the Stellar public key and a positive weight,
 * then proposes the on-chain set_options config transaction through the
 * signing pipeline, carrying the roster change as `pendingChange`. The API
 * applies it to the off-chain roster only once the transaction collects the
 * high threshold and is submitted on-chain — until then the signer has no
 * power anywhere. Closes and resets on success; surfaces API errors
 * (duplicate signer, permission) inline.
 */
export function AddMemberDialog({
  accountId,
  stellarAccountId,
}: {
  accountId: string;
  stellarAccountId: string;
}) {
  const [open, setOpen] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [weight, setWeight] = useState("1");
  const [role, setRole] = useState<MemberRole>("member");
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const propose = useProposeAndSign(accountId, user?.publicKey);
  const [busy, setBusy] = useState(false);

  const keyValid = StrKey.isValidEd25519PublicKey(publicKey.trim());
  const weightNum = Number(weight);
  const weightValid = Number.isInteger(weightNum) && weightNum > 0;
  const canSubmit = keyValid && weightValid && !busy;

  function reset() {
    setPublicKey("");
    setWeight("1");
    setRole("member");
    setError(null);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const key = publicKey.trim();
    try {
      // Build the on-chain set_options envelope, then propose it into the
      // sign/submit pipeline. The roster change rides along as pendingChange
      // and is applied server-side once the transaction is submitted on-chain.
      const built = await buildAddMemberXdr(stellarAccountId, {
        publicKey: key,
        weight: weightNum,
      });
      await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        memo: `Add signer ${key.slice(0, 4)}…${key.slice(-4)}`,
        pendingChange: { kind: "member.add", publicKey: key, weight: weightNum, role },
      });
      reset();
      setOpen(false);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          <UserPlus className="size-4" /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a signer</DialogTitle>
          <DialogDescription>
            Propose adding a signer to this multisig. Weight determines how
            much it contributes toward each threshold. The change takes effect
            once the current signers approve it on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Public key</span>
            <Input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="G…"
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={publicKey.length > 0 && !keyValid}
            />
            {publicKey.length > 0 && !keyValid && (
              <span className="text-destructive text-xs">
                Not a valid Stellar public key.
              </span>
            )}
          </label>

          <label className="flex w-32 flex-col gap-1.5">
            <span className="text-sm font-medium">Weight</span>
            <Input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="font-mono"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Role</span>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors",
                    role === r.value
                      ? "border-[var(--gold)]/60 bg-[var(--surface-2)]"
                      : "border-[var(--hairline)] hover:bg-[var(--surface)]",
                  )}
                >
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-muted-foreground text-xs">{r.help}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-[var(--hairline)] bg-transparent"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={submit}
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Adding…
              </>
            ) : (
              "Add member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
