import { rpc } from "@stellar/stellar-sdk";

/**
 * Read the mainnet RPC endpoint from the environment. No provider is hardcoded —
 * STELLAR_RPC_URL is swappable without code changes (per the locked design).
 */
export function getRpcUrl(): string {
  const url = process.env.STELLAR_RPC_URL;
  if (!url) {
    throw new Error("STELLAR_RPC_URL is not set. Refusing to construct an RPC client.");
  }
  return url;
}

/**
 * Construct an `rpc.Server` for the configured mainnet RPC endpoint.
 * `allowHttp` is left default (false) — mainnet endpoints must be https.
 */
export function getRpcServer(url: string = getRpcUrl()): rpc.Server {
  return new rpc.Server(url);
}
