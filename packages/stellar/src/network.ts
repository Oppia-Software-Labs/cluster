import { Networks } from "@stellar/stellar-sdk";

/** The two Stellar networks Cluster can target. */
export type StellarNetwork = "mainnet" | "testnet";

/** Stellar public-network passphrase. */
export const MAINNET_NETWORK_PASSPHRASE: string = Networks.PUBLIC;

/** Stellar testnet passphrase. */
export const TESTNET_NETWORK_PASSPHRASE: string = Networks.TESTNET;

/**
 * The active network, selected by the STELLAR_NETWORK env var (API/server) or
 * NEXT_PUBLIC_STELLAR_NETWORK (web). Defaults to mainnet — real funds — when
 * unset, so a missing variable can never silently downgrade safety
 * assumptions the other way (testnet is the explicit opt-in).
 *
 * Read at call time, not module-eval time, so tests and tooling can set the
 * env var after import. Browser bundles should not rely on this (bundlers
 * don't inline env vars inside node_modules); the web app resolves the
 * network in its own source and passes passphrases explicitly.
 */
export function getStellarNetwork(): StellarNetwork {
  const raw =
    process.env.STELLAR_NETWORK ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  if (raw !== undefined && raw !== "mainnet" && raw !== "testnet") {
    throw new Error(
      `Invalid STELLAR_NETWORK "${raw}" — expected "mainnet" or "testnet".`,
    );
  }
  return raw === "testnet" ? "testnet" : "mainnet";
}

/** Resolve the passphrase for a given network. Defaults to the active network. */
export function getNetworkPassphrase(
  network: StellarNetwork = getStellarNetwork(),
): string {
  return network === "testnet"
    ? TESTNET_NETWORK_PASSPHRASE
    : MAINNET_NETWORK_PASSPHRASE;
}
