import { getStellarNetwork, type StellarNetwork } from "./network.js";

/**
 * Read the Horizon endpoint from the environment. No provider is hardcoded.
 *
 * STELLAR_HORIZON_URL always points at the ACTIVE network (whatever
 * STELLAR_NETWORK says). STELLAR_TESTNET_HORIZON_URL exists only for the
 * cross-network opt-in: reading a public testnet balance while the app runs
 * on mainnet (e.g. the confidential-token deposit precondition). There is no
 * mirror-image mainnet override — a testnet deployment must never be one
 * env var away from reading against the real network.
 */
export function getHorizonUrl(network: StellarNetwork = getStellarNetwork()): string {
  const active = getStellarNetwork();
  if (network === active) {
    const url = process.env.STELLAR_HORIZON_URL;
    if (!url) {
      throw new Error(
        "STELLAR_HORIZON_URL is not set. Refusing to construct a Horizon client.",
      );
    }
    return url;
  }
  if (network === "testnet") {
    const url = process.env.STELLAR_TESTNET_HORIZON_URL;
    if (!url) {
      throw new Error(
        "STELLAR_TESTNET_HORIZON_URL is not set. Refusing to construct a Horizon client.",
      );
    }
    return url;
  }
  throw new Error(
    "Refusing to build a mainnet Horizon client while STELLAR_NETWORK=testnet.",
  );
}
