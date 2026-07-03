"use client";

import { use } from "react";
import { notFound } from "next/navigation";

import { vaults } from "@/lib/vaults";
import { useAccount } from "@/lib/queries";
import { VaultDetail } from "@/components/invest/vault-detail";

export default function VaultDetailPage({
  params,
}: {
  params: Promise<{ accountId: string; vaultAddress: string }>;
}) {
  const { accountId, vaultAddress } = use(params);
  const { data: account } = useAccount(accountId);

  const vault = vaults.find((v) => v.address === vaultAddress);
  if (!vault) notFound();

  return (
    <VaultDetail
      vault={vault}
      accountId={accountId}
      stellarAccountId={account?.stellarAccountId}
      backHref={`/${accountId}/invest`}
    />
  );
}
