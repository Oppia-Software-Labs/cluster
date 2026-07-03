import { rpc } from "@stellar/stellar-sdk";
import { getStellarNetwork, type StellarNetwork } from "./network.js";

/**
 * Read the RPC endpoint from the environment. No provider is hardcoded.
 *
 * STELLAR_RPC_URL always points at the ACTIVE network (whatever
 * STELLAR_NETWORK says). STELLAR_TESTNET_RPC_URL exists only for the
 * cross-network opt-in: a transaction that explicitly targets testnet while
 * the app runs on mainnet (e.g. DeFindex testnet vaults). There is no
 * mirror-image mainnet override — a testnet deployment must never be one
 * env var away from broadcasting real-fund transactions.
 */
export function getRpcUrl(network: StellarNetwork = getStellarNetwork()): string {
  const active = getStellarNetwork();
  if (network === active) {
    const url = process.env.STELLAR_RPC_URL;
    if (!url) {
      throw new Error(
        "STELLAR_RPC_URL is not set. Refusing to construct an RPC client.",
      );
    }
    return url;
  }
  if (network === "testnet") {
    const url = process.env.STELLAR_TESTNET_RPC_URL;
    if (!url) {
      throw new Error(
        "STELLAR_TESTNET_RPC_URL is not set. Refusing to construct an RPC client.",
      );
    }
    return url;
  }
  throw new Error(
    "Refusing to build a mainnet RPC client while STELLAR_NETWORK=testnet.",
  );
}

/**
 * Construct an `rpc.Server` for the configured RPC endpoint.
 * `allowHttp` is left default (false) — endpoints must be https.
 */
export function getRpcServer(url: string = getRpcUrl()): rpc.Server {
  return new rpc.Server(url);
}
