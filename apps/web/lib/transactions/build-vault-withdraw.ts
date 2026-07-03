import type { BuildVaultWithdrawXdrResponse, ProposeTransactionDto } from "@cluster/shared";
import { http } from "@/lib/http";

export type VaultWithdrawDraft = {
  /** The multisig account's own Stellar address — DeFindex's `caller`. */
  source: string;
  vaultAddress: string;
  /** Decimal amount of the underlying asset as typed by the user. */
  amount: string;
};

/**
 * Ask the API to build an unsigned withdrawal envelope for a DeFindex
 * testnet vault. Mirrors `buildVaultDepositXdr` — see that file for why the
 * DeFindex key never reaches the browser.
 */
export async function buildVaultWithdrawXdr(
  draft: VaultWithdrawDraft,
): Promise<Pick<ProposeTransactionDto, "type" | "xdr" | "thresholdLevel" | "network">> {
  const { data } = await http.post<BuildVaultWithdrawXdrResponse>(
    `/defindex/vault/${draft.vaultAddress}/withdraw-xdr`,
    { caller: draft.source, amount: draft.amount },
  );
  return {
    xdr: data.xdr,
    type: "vault_withdraw",
    thresholdLevel: "medium",
    network: "testnet",
  };
}
