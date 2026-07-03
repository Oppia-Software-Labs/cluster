import { rpc } from "@stellar/stellar-sdk";

/**
 * Read the RPC endpoint from the environment. No provider is hardcoded —
 * STELLAR_RPC_URL (mainnet, default) / STELLAR_TESTNET_RPC_URL (the
 * vault_deposit opt-in path) are swappable without code changes.
 */
export function getRpcUrl(network: "mainnet" | "testnet" = "mainnet"): string {
  const envVar =
    network === "testnet" ? "STELLAR_TESTNET_RPC_URL" : "STELLAR_RPC_URL";
  const url = process.env[envVar];
  if (!url) {
    throw new Error(`${envVar} is not set. Refusing to construct an RPC client.`);
  }
  return url;
}

/**
 * Construct an `rpc.Server` for the configured RPC endpoint.
 * `allowHttp` is left default (false) — mainnet endpoints must be https.
 */
export function getRpcServer(url: string = getRpcUrl()): rpc.Server {
  return new rpc.Server(url);
}
