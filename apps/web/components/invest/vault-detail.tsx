"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@cluster/ui";
import type { Vault } from "@/lib/vaults";
import { useAuth } from "@/lib/auth";
import { useBalances } from "@/lib/assets.queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { useVaultBalance } from "@/lib/vault-balance.queries";
import { buildVaultDepositXdr } from "@/lib/transactions/build-vault-deposit";
import { buildVaultWithdrawXdr } from "@/lib/transactions/build-vault-withdraw";
import { explorerUrl } from "@/lib/stellar-network";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function fromStroops(raw: string | undefined, decimals: number): number {
  if (!raw) return 0;
  return Number(raw) / 10 ** decimals;
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

type Mode = "deposit" | "withdraw";

function ActionPanel({
  mode,
  vault,
  accountId,
  stellarAccountId,
  backHref,
}: {
  mode: Mode;
  vault: Vault;
  accountId: string;
  stellarAccountId: string;
  backHref: string;
}) {
  const { user } = useAuth();
  const propose = useProposeAndSign(accountId, user?.publicKey);
  const { data: balances } = useBalances(accountId);
  const { data: position } = useVaultBalance(vault.address, stellarAccountId, vault.network);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ id: string; signed: boolean } | null>(null);

  const walletBalance = balances?.balances.find((b) =>
    vault.asset === "XLM" ? !b.assetIssuer : b.assetCode === vault.asset,
  );
  const depositMax = walletBalance ? Number(walletBalance.amount) : undefined;
  const withdrawMax = fromStroops(position?.underlyingBalance?.[0], vault.decimals);
  const max = mode === "deposit" ? depositMax : withdrawMax;

  const amountNum = Number(amount);
  const amountValid = amount.length > 0 && amountNum > 0 && (max === undefined || amountNum <= max);
  const canSubmit = amountValid && !propose.isPending;

  async function submit() {
    setError(null);
    try {
      const build = mode === "deposit" ? buildVaultDepositXdr : buildVaultWithdrawXdr;
      const built = await build({
        source: stellarAccountId,
        vaultAddress: vault.address,
        amount,
        network: vault.network,
      });
      const { tx, signed } = await propose.mutateAsync({
        ...built,
        memo: `${mode === "deposit" ? "Deposit" : "Withdraw"} ${amount} ${vault.asset} ${mode === "deposit" ? "into" : "from"} ${vault.name}`,
      });
      setProposed({ id: tx.id, signed });
    } catch (e) {
      setError(apiError(e));
    }
  }

  if (proposed) {
    return (
      <div className="cl-card flex flex-col items-center gap-3 p-6 text-center">
        <div className="grid size-12 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
          <CheckCircle2 className="size-6 text-[var(--signal)]" />
        </div>
        <p className="text-sm font-semibold">
          {mode === "deposit" ? "Deposit" : "Withdrawal"} proposed
        </p>
        <p className="text-muted-foreground text-xs">
          {proposed.signed
            ? "Signed with your wallet — submits automatically once the threshold is met."
            : "Your wallet didn’t sign it yet — sign it from Activity."}
        </p>
        <div className="mt-1 flex gap-2">
          <Button asChild size="sm" variant="outline" className="border-[var(--hairline)] bg-transparent">
            <Link href={backHref}>Back to vaults</Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setProposed(null);
              setAmount("");
            }}
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {mode === "deposit" ? "Deposit again" : "Withdraw again"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="cl-card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {mode === "deposit" ? "Deposit" : "Withdraw"} {vault.asset}
          </span>
          <Image src={vault.logo} alt="" width={24} height={24} className="object-contain" />
        </div>
        <Input
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="h-14 border-none bg-transparent py-0 pr-0 pl-3 text-3xl font-medium shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {max !== undefined ? `Max ${formatAmount(max)} ${vault.asset}` : " "}
          </span>
          {max !== undefined && max > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(max))}
              className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold hover:bg-[var(--hairline)]"
            >
              MAX
            </button>
          )}
        </div>
      </div>

      <div className="cl-card flex flex-col divide-y divide-[var(--hairline)] p-0">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Network</span>
          <Badge variant="outline" className="font-mono uppercase">
            {vault.network}
          </Badge>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {mode === "deposit" ? "Wallet balance" : "Your position"}
          </span>
          <span className="font-mono tabular-nums">
            {formatAmount(mode === "deposit" ? (depositMax ?? 0) : withdrawMax)} {vault.asset}
          </span>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        disabled={!canSubmit}
        onClick={submit}
        size="lg"
        className="h-12 w-full bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
      >
        {propose.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Proposing…
          </>
        ) : (
          `${mode === "deposit" ? "Deposit" : "Withdraw"} ${vault.asset}`
        )}
      </Button>
    </div>
  );
}

export function VaultDetail({
  vault,
  accountId,
  stellarAccountId,
  backHref,
}: {
  vault: Vault;
  accountId: string;
  stellarAccountId?: string;
  backHref: string;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("action") === "withdraw" ? "withdraw" : "deposit";
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(vault.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href={backHref}
        className="text-muted-foreground inline-flex w-fit items-center gap-1.5 text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to Vaults
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: vault info */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Image
              src={vault.logo}
              alt=""
              width={56}
              height={56}
              className="shrink-0 rounded-full border border-[var(--hairline)] bg-white object-contain p-2"
            />
            <div className="flex flex-col gap-1">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
                {vault.name}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
                >
                  {truncate(vault.address)}
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
                <a
                  href={explorerUrl(`contract/${vault.address}`, vault.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="View on Explorer"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-y border-[var(--hairline)] py-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                Supply asset
              </span>
              <div className="flex items-center gap-1.5">
                <Image src={vault.logo} alt="" width={18} height={18} className="object-contain" />
                <span className="text-lg font-semibold">{vault.asset}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                Network
              </span>
              <span className="text-lg font-semibold capitalize">{vault.network}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                Strategy
              </span>
              <span className="text-lg font-semibold">{vault.symbol}</span>
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            {vault.name} deploys {vault.asset} into {vault.strategy} on Stellar{" "}
            {vault.network}. Deposits and withdrawals are proposed through the
            multisig pipeline and submit on-chain automatically once the
            account&apos;s signers approve.
          </p>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Strategy</h2>
            <div className="cl-card flex items-center justify-between p-4">
              <div className="flex flex-col">
                <span className="font-mono text-sm">{vault.strategy}</span>
                <span className="text-muted-foreground text-xs">Asset {vault.asset}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: deposit/withdraw */}
        <div className="flex flex-col gap-4">
          <Tabs defaultValue={initialTab} className="gap-4">
            <TabsList className="bg-[var(--surface)] w-full">
              <TabsTrigger value="deposit" className="flex-1">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="flex-1">
                Withdraw
              </TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              {stellarAccountId ? (
                <ActionPanel
                  mode="deposit"
                  vault={vault}
                  accountId={accountId}
                  stellarAccountId={stellarAccountId}
                  backHref={backHref}
                />
              ) : (
                <p className="text-muted-foreground text-sm">Connect an account first.</p>
              )}
            </TabsContent>
            <TabsContent value="withdraw">
              {stellarAccountId ? (
                <ActionPanel
                  mode="withdraw"
                  vault={vault}
                  accountId={accountId}
                  stellarAccountId={stellarAccountId}
                  backHref={backHref}
                />
              ) : (
                <p className="text-muted-foreground text-sm">Connect an account first.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
