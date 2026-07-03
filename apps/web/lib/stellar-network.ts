import {
  MAINNET_NETWORK_PASSPHRASE,
  TESTNET_NETWORK_PASSPHRASE,
  type StellarNetwork,
} from "@cluster/stellar";

export type { StellarNetwork };

/**
 * The active Stellar network for the web app, selected by
 * NEXT_PUBLIC_STELLAR_NETWORK at build time. This is the ONLY place the env
 * var is read — Next.js inlines `process.env.NEXT_PUBLIC_*` in app source,
 * but not inside node_modules, so the @cluster/stellar env fallback cannot be
 * trusted in the browser. Defaults to mainnet (real funds) when unset.
 */
export const STELLAR_NETWORK: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ? "testnet" : "mainnet";

/** Passphrase of the active network. */
export const NETWORK_PASSPHRASE: string =
  STELLAR_NETWORK === "testnet"
    ? TESTNET_NETWORK_PASSPHRASE
    : MAINNET_NETWORK_PASSPHRASE;

/** Human label for the active network, e.g. for chips/menus. */
export const NETWORK_LABEL = STELLAR_NETWORK === "testnet" ? "Testnet" : "Mainnet";

/**
 * Resolve the passphrase for a per-transaction network override. When the
 * transaction doesn't carry an explicit network (payments, trustlines,
 * config changes — everything except vault flows), it targets the ACTIVE
 * network, so that passphrase is the default.
 */
export function passphraseFor(network: string | null | undefined): string {
  if (network === "testnet") return TESTNET_NETWORK_PASSPHRASE;
  if (network === "mainnet") return MAINNET_NETWORK_PASSPHRASE;
  return NETWORK_PASSPHRASE;
}

/**
 * stellar.expert explorer URL for a path like `tx/<hash>` or
 * `account/<G...>`, on the given network (default: the active one).
 */
export function explorerUrl(
  path: string,
  network: StellarNetwork = STELLAR_NETWORK,
): string {
  const segment = network === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${segment}/${path}`;
}
