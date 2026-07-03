"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { useAccounts } from "@/lib/queries";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { InvestSection } from "@/components/invest/invest-section";

/**
 * Account-agnostic shortcut to Invest: `/dashboard/invest`, rather than
 * `/<accountId>/invest`. Every other page in the app is scoped by an
 * accountId path segment (see `(dashboard)/[accountId]`); this route lives
 * outside that group so it doesn't get swallowed by the `[accountId]`
 * catch-all (which would otherwise treat the literal string "dashboard" as
 * an account id and silently 404 on data). It auto-picks the signed-in
 * user's first multisig account — fine while most testers have exactly one;
 * revisit with an account picker if that stops being true.
 *
 * A deposit/withdraw proposal is always attached to a real multisig account
 * (Transaction.accountId is a required FK), so both guards below are load-
 * bearing, not just UX polish: without a session there's no signer identity
 * to propose as, and without an account there's nothing to attach the
 * proposal to (POST would hit `/accounts//transactions`).
 */
export default function DashboardInvestPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/accounts");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return null;
  }

  const account = accounts?.[0];
  const sidebarAccountId = account?.stellarAccountId ?? account?.id ?? "";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar accountId={sidebarAccountId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {!accountsLoading && !account ? (
            <p className="text-muted-foreground mx-auto max-w-3xl text-sm">
              You don't have a multisig account yet — create one first from{" "}
              <a href="/accounts" className="text-[var(--gold)] hover:underline">
                Accounts
              </a>
              .
            </p>
          ) : (
            <InvestSection
              accountId={account?.id ?? ""}
              stellarAccountId={account?.stellarAccountId}
            />
          )}
        </main>
      </div>
    </div>
  );
}
