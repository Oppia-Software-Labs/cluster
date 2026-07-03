"use client";

import { useState } from "react";
import { ArrowDownToLine, Loader2, PiggyBank } from "lucide-react";

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
} from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { buildVaultDepositXdr } from "@/lib/transactions/build-vault-deposit";
import { buildVaultWithdrawXdr } from "@/lib/transactions/build-vault-withdraw";
import { apiError } from "@/lib/api-error";

type Mode = "deposit" | "withdraw";

const COPY: Record<
  Mode,
  {
    verb: string;
    verbing: string;
    icon: typeof PiggyBank;
    description: (networkLabel: string) => string;
  }
> = {
  deposit: {
    verb: "Deposit",
    verbing: "Depositing",
    icon: PiggyBank,
    description: (networkLabel) =>
      `Proposes a deposit transaction on Stellar ${networkLabel}. The account's other signers approve it on /activity — it submits on-chain automatically once the threshold is met.`,
  },
  withdraw: {
    verb: "Withdraw",
    verbing: "Withdrawing",
    icon: ArrowDownToLine,
    description: (networkLabel) =>
      `Proposes a withdrawal transaction on Stellar ${networkLabel}, burning vault shares for the underlying asset. The account's other signers approve it on /activity — it submits on-chain automatically once the threshold is met.`,
  },
};

/**
 * Deposit/withdraw dialog for a DeFindex vault. Builds the unsigned
 * envelope via the API (which holds the DeFindex key), then proposes it into
 * the same sign/submit pipeline as every other transaction type — it shows
 * up on /activity for the account's other signers to approve.
 */
export function VaultActionDialog({
  mode,
  accountId,
  stellarAccountId,
  vaultAddress,
  vaultName,
  asset,
  network,
}: {
  mode: Mode;
  accountId: string;
  stellarAccountId: string;
  vaultAddress: string;
  vaultName: string;
  asset: string;
  network: "testnet" | "mainnet";
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { user } = useAuth();
  const propose = useProposeAndSign(accountId, user?.publicKey);
  const copy = COPY[mode];
  const Icon = copy.icon;

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = amountValid && !busy;

  function reset() {
    setAmount("");
    setError(null);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const build = mode === "deposit" ? buildVaultDepositXdr : buildVaultWithdrawXdr;
      const built = await build({
        source: stellarAccountId,
        vaultAddress,
        amount,
        network,
      });
      await propose.mutateAsync({
        ...built,
        memo: `${copy.verb} ${amount} ${asset} ${mode === "deposit" ? "into" : "from"} ${vaultName}`,
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
          variant={mode === "deposit" ? "default" : "outline"}
          className={
            mode === "deposit"
              ? "bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
              : "border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]"
          }
        >
          <Icon className="size-4" /> {copy.verb}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {copy.verb} {mode === "deposit" ? "into" : "from"} {vaultName}
          </DialogTitle>
          <DialogDescription>{copy.description(network)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Amount ({asset})</span>
            <Input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={amount.length > 0 && !amountValid}
            />
            {amount.length > 0 && !amountValid && (
              <span className="text-destructive text-xs">
                Enter a positive amount.
              </span>
            )}
          </label>

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
                <Loader2 className="size-4 animate-spin" /> {copy.verbing}…
              </>
            ) : (
              `Propose ${mode}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
