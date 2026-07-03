import { Networks } from "@stellar/stellar-sdk";

/**
 * Cluster operates on the Stellar public network by default — every
 * transaction is real funds. "testnet" is a narrow, explicit opt-in used
 * today only by `vault_deposit` transactions against DeFindex's testnet
 * vaults; every other transaction type keeps defaulting to mainnet.
 */
export const STELLAR_NETWORK = "mainnet" as const;

/** Stellar public-network passphrase. Used by every TransactionBuilder/fromXDR call. */
export const NETWORK_PASSPHRASE: string = Networks.PUBLIC;

/** Stellar testnet passphrase — only for the testnet opt-in path above. */
export const TESTNET_NETWORK_PASSPHRASE: string = Networks.TESTNET;

/** Resolve the passphrase for a given network. Defaults to mainnet. */
export function getNetworkPassphrase(
  network: "mainnet" | "testnet" = "mainnet",
): string {
  return network === "testnet" ? TESTNET_NETWORK_PASSPHRASE : NETWORK_PASSPHRASE;
}
