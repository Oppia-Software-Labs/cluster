import type { BuildVaultDepositXdrResponse, ProposeTransactionDto } from "@cluster/shared";
import { http } from "@/lib/http";

export type VaultDepositDraft = {
  /** The multisig account's own Stellar address — DeFindex's `caller`. */
  source: string;
  vaultAddress: string;
  /** Network the vault lives on. */
  network: "testnet" | "mainnet";
  /** Decimal amount as typed by the user, e.g. "10.5". */
  amount: string;
};

/**
 * Ask the API to build an unsigned deposit envelope for a DeFindex vault
 * (the API holds the DeFindex key; this never touches it directly).
 * Returned shape plugs straight into `useProposeAndSign`.
 */
export async function buildVaultDepositXdr(
  draft: VaultDepositDraft,
): Promise<Pick<ProposeTransactionDto, "type" | "xdr" | "thresholdLevel" | "network">> {
  const { data } = await http.post<BuildVaultDepositXdrResponse>(
    `/defindex/vault/${draft.vaultAddress}/deposit-xdr`,
    { caller: draft.source, amount: draft.amount, network: draft.network },
  );
  return {
    xdr: data.xdr,
    type: "vault_deposit",
    thresholdLevel: "medium",
    network: draft.network,
  };
}
