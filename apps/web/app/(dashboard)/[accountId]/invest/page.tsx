"use client";

import { use } from "react";

import { useAccount } from "@/lib/queries";
import { InvestSection } from "@/components/invest/invest-section";

export default function InvestPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { data: account } = useAccount(accountId);

  return (
    <InvestSection accountId={accountId} stellarAccountId={account?.stellarAccountId} />
  );
}
