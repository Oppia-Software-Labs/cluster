import type { BuildVaultWithdrawXdrResponse, ProposeTransactionDto } from "@cluster/shared";
import { http } from "@/lib/http";

export type VaultWithdrawDraft = {
  /** The multisig account's own Stellar address — DeFindex's `caller`. */
  source: string;
  vaultAddress: string;
  /** Network the vault lives on. */
  network: "testnet" | "mainnet";
  /** Decimal amount of the underlying asset as typed by the user. */
  amount: string;
};

/**
 * Ask the API to build an unsigned withdrawal envelope for a DeFindex vault.
 * Mirrors `buildVaultDepositXdr` — see that file for why the DeFindex key
 * never reaches the browser.
 */
export async function buildVaultWithdrawXdr(
  draft: VaultWithdrawDraft,
): Promise<Pick<ProposeTransactionDto, "type" | "xdr" | "thresholdLevel" | "network">> {
  const { data } = await http.post<BuildVaultWithdrawXdrResponse>(
    `/defindex/vault/${draft.vaultAddress}/withdraw-xdr`,
    { caller: draft.source, amount: draft.amount, network: draft.network },
  );
  return {
    xdr: data.xdr,
    type: "vault_withdraw",
    thresholdLevel: "medium",
    network: draft.network,
  };
}
