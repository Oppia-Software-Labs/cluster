"use client";

import { Button } from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { AccountsList } from "@/components/accounts/accounts-list";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

/**
 * Authenticated landing for choosing or creating a multisig account. Lives
 * outside /[accountId] so a brand-new user with zero accounts has somewhere to
 * land. Connect-wallet gate uses the shared auth session (M1); the list and
 * empty state come from AccountsList.
 */
export default function AccountsPage() {
  const { user, status, login, error } = useAuth();
  const busy = status === "connecting" || status === "authenticating";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
            C
          </div>
          <span className="text-base font-semibold">Cluster</span>
        </div>
        {user && (
          <span className="text-muted-foreground font-mono text-xs">
            {truncate(user.publicKey)}
          </span>
        )}
      </header>

      {!user ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border p-10 text-center">
          <h1 className="text-lg font-semibold">Connect your wallet</h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            Connect a Stellar wallet to view and manage your multisig accounts.
          </p>
          <Button onClick={() => login()} disabled={busy || status === "loading"}>
            {busy ? "Connecting…" : "Connect wallet"}
          </Button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold">Your accounts</h1>
          <AccountsList />
        </section>
      )}
    </main>
  );
}
