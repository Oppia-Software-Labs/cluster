import { Networks } from "@stellar/stellar-sdk";

/**
 * MAINNET ONLY. Cluster operates exclusively on the Stellar public network.
 * There is no testnet path in this codebase — every transaction is real funds.
 */
export const STELLAR_NETWORK = "mainnet" as const;

/** Stellar public-network passphrase. Used by every TransactionBuilder/fromXDR call. */
export const NETWORK_PASSPHRASE: string = Networks.PUBLIC;

/** Helper returning the mainnet passphrase (single source of truth). */
export function getNetworkPassphrase(): string {
  return NETWORK_PASSPHRASE;
}
