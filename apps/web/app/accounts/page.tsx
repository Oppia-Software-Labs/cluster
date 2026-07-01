"use client";

import { Fingerprint, Loader2, Wallet } from "lucide-react";

import { Button } from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { AccountsList } from "@/components/accounts/accounts-list";
import { ClusterMark } from "@/components/landing/cluster-mark";
import { WalletMenu } from "@/components/shell/wallet-menu";

/**
 * Authenticated landing for choosing or creating a multisig account. Lives
 * outside /[accountId] so a brand-new user with zero accounts has somewhere to
 * land. Connect-wallet gate uses the shared auth session; the list and empty
 * state come from AccountsList.
 */
export default function AccountsPage() {
  const { user, status, login, error } = useAuth();
  const busy = status === "connecting" || status === "authenticating";

  return (
    <main className="relative min-h-dvh overflow-x-hidden font-[family-name:var(--font-sans)]">
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <ClusterMark />
          <WalletMenu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        {!user ? (
          <ConnectGate onLogin={login} busy={busy} loading={status === "loading"} error={error} />
        ) : (
          <section className="cl-reveal flex flex-col gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                your vaults
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
                Multisig accounts
              </h1>
            </div>
            <AccountsList />
          </section>
        )}
      </div>
    </main>
  );
}

function ConnectGate({
  onLogin,
  busy,
  loading,
  error,
}: {
  onLogin: () => void;
  busy: boolean;
  loading: boolean;
  error?: string | null;
}) {
  return (
    <div className="cl-reveal mx-auto mt-8 w-full max-w-md rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-10 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[var(--hairline)] bg-[var(--surface-2)]">
        <Fingerprint className="size-7" />
      </div>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
        Connect your wallet
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Sign in with a Stellar wallet to view and manage the multisig accounts
        you belong to.
      </p>
      <Button
        onClick={onLogin}
        disabled={busy || loading}
        size="lg"
        className="mt-7 h-11 w-full"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Connecting…
          </>
        ) : (
          <>
            <Wallet className="size-4" /> Connect wallet
          </>
        )}
      </Button>
      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
    </div>
  );
}
