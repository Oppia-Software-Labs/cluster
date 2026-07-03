/**
 * Shared confidential-token chain config for the web app.
 *
 * Centralizes the env-derived contract triple and {@link ChainClient} factory
 * that {@link useConfidentialTransfers} previously built inline, plus the
 * {@link SorobanContext} slice the `@cluster/stellar` confidential builders
 * need for simulate+assemble. Amount helpers convert between human XLM strings
 * and on-chain stroops (7 decimal places).
 *
 * This module is the read/config half of the propose→prove→build seam; the
 * prove+build half lives in {@link ./propose.js}.
 */

import { ChainClient } from "@cluster/zk/chain";
import type { SorobanContext } from "@cluster/stellar";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";

/** Confidential-token contract the web app targets (testnet demo). */
export const CONFIDENTIAL_TOKEN_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID ?? "";

const STROOPS_PER_XLM = BigInt(10_000_000);

let cachedClient: ChainClient | undefined;

/**
 * Lazily construct and memoize a {@link ChainClient} for confidential-token
 * reads and auditor-key lookups. Contract ids fall back to
 * {@link CONFIDENTIAL_TOKEN_ID} when verifier/auditor env vars are unset,
 * matching {@link useConfidentialTransfers}.
 */
export function getConfidentialChainClient(): ChainClient {
  if (!cachedClient) {
    const token = CONFIDENTIAL_TOKEN_ID;
    const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "";
    const verifier =
      process.env.NEXT_PUBLIC_CONFIDENTIAL_VERIFIER_CONTRACT_ID ?? token;
    const auditor =
      process.env.NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_CONTRACT_ID ?? token;

    cachedClient = new ChainClient({
      rpcUrl,
      networkPassphrase: NETWORK_PASSPHRASE,
      contracts: {
        token,
        verifier,
        auditor,
      },
    });
  }
  return cachedClient;
}

/** Soroban simulate+assemble context for the confidential builders. */
export function getSorobanContext(): SorobanContext {
  return {
    rpcServer: getConfidentialChainClient().server,
    networkPassphrase: NETWORK_PASSPHRASE,
  };
}

/**
 * Parse a decimal XLM string into stroops (7 decimal places). Throws a readable
 * {@link Error} on malformed input or more than 7 fractional digits.
 */
export function xlmToStroops(amount: string): bigint {
  const s = amount.trim();
  if (!s) {
    throw new Error("Invalid XLM amount: empty string");
  }

  const neg = s.startsWith("-");
  const body = neg ? s.slice(1).trim() : s;

  if (!/^\d*\.?\d+$/.test(body)) {
    throw new Error(`Invalid XLM amount: ${amount}`);
  }

  const [wholePart, fracPart = ""] = body.split(".");
  if (fracPart.length > 7) {
    throw new Error(`XLM amount has more than 7 decimal places: ${amount}`);
  }

  const whole = BigInt(wholePart || "0");
  const frac = fracPart.padEnd(7, "0");
  let stroops = whole * STROOPS_PER_XLM + BigInt(frac);
  if (neg) stroops = -stroops;
  return stroops;
}

/** Stroops (bigint, 7 dp) → human XLM string with trailing zeros trimmed. */
export function stroopsToXlm(v: bigint): string {
  const neg = v < BigInt(0);
  const abs = neg ? -v : v;
  const whole = abs / STROOPS_PER_XLM;
  const frac = (abs % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
