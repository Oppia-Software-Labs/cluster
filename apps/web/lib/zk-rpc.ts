import { ChainClient } from "@cluster/zk/chain";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;
const TOKEN_CONTRACT_ID = process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID;
// Auditor/verifier ids are not read on the read-only surfaces (/verify only
// resolves events + the token binding), but `ChainConfig` requires the full
// triple. Fall back to the token id when they're unset, matching the existing
// read-only confidential hooks.
const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_VERIFIER_CONTRACT_ID;
const AUDITOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_CONTRACT_ID;

/**
 * Read-only chain client for the PUBLIC confidential surfaces (/verify, and a
 * later /auditor). No wallet, no signer — only the RPC endpoint + the deployed
 * token contract id. Kept in one place so the public pages never reach for
 * anything auth-related; this is the single wallet-free RPC entry point.
 *
 * Throws a clear error when either required env var is missing, rather than
 * letting a half-configured client fail deep inside an RPC simulate.
 */
export function getZkRpcClient(): ChainClient {
  if (!RPC_URL || !TOKEN_CONTRACT_ID) {
    throw new Error(
      "Confidential RPC not configured (NEXT_PUBLIC_STELLAR_RPC_URL / NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID).",
    );
  }
  return new ChainClient({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    contracts: {
      token: TOKEN_CONTRACT_ID,
      verifier: VERIFIER_CONTRACT_ID ?? TOKEN_CONTRACT_ID,
      auditor: AUDITOR_CONTRACT_ID ?? TOKEN_CONTRACT_ID,
    },
  });
}
