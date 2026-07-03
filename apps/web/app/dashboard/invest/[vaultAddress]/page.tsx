"use client";

import { use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { useAccounts } from "@/lib/queries";
import { vaults } from "@/lib/vaults";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { VaultDetail } from "@/components/invest/vault-detail";

/** Vault detail for the /dashboard/invest shortcut — see that page's docstring. */
export default function DashboardVaultDetailPage({
  params,
}: {
  params: Promise<{ vaultAddress: string }>;
}) {
  const { vaultAddress } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: accounts } = useAccounts();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/accounts");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return null;
  }

  const vault = vaults.find((v) => v.address === vaultAddress);
  if (!vault) notFound();

  const account = accounts?.[0];
  const sidebarAccountId = account?.stellarAccountId ?? account?.id ?? "";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar accountId={sidebarAccountId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <VaultDetail
            vault={vault}
            accountId={account?.id ?? ""}
            stellarAccountId={account?.stellarAccountId}
            backHref="/dashboard/invest"
          />
        </main>
      </div>
    </div>
  );
}
