import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import { getRpcServer } from "./rpc.js";

export interface SubmitOptions {
  /** RPC server (real or mocked). Defaults to a server from getRpcServer() if omitted. */
  server?: rpc.Server;
  networkPassphrase: string;
  /** Delay between polls in ms (0 in tests). Default 2000. */
  pollIntervalMs?: number;
  /** Max poll attempts before timing out. Default 30. */
  maxPolls?: number;
}

export interface SubmitResult {
  hash: string;
  status: Api.GetTransactionStatus;
}

/** Default poll cadence + cap → a ~60s (30 × 2000ms) bounded result-polling window. */
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLLS = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit a fully-signed base64 XDR to mainnet and poll until the result is final.
 *
 * MAINNET = REAL FUNDS. Only call with an XDR whose signatures already satisfy
 * the account thresholds (see signatures.isThresholdMet). Submitting an
 * under-signed transaction wastes the base fee and fails on-chain.
 */
export async function submitSignedXdr(
  signedXdr: string,
  options: SubmitOptions,
): Promise<SubmitResult> {
  const {
    server = getRpcServer(),
    networkPassphrase,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPolls = DEFAULT_MAX_POLLS,
  } = options;

  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sent = await server.sendTransaction(tx as any);

  if (sent.status === "ERROR") {
    throw new Error(
      `sendTransaction returned ERROR for ${sent.hash}: ${JSON.stringify(sent.errorResult ?? {})}`,
    );
  }

  if (sent.status === "TRY_AGAIN_LATER") {
    // The tx was NOT queued (mempool full / rate-limited), so getTransaction(hash)
    // would return NOT_FOUND for every poll and surface a misleading timeout.
    // Surface it as a distinct, retryable error instead.
    throw new Error(
      `sendTransaction returned TRY_AGAIN_LATER for ${sent.hash}: transaction was not queued (retry later)`,
    );
  }

  // DUPLICATE intentionally falls through to the poll loop: the prior submission's
  // result is discoverable by the same hash, so polling resolves it normally.
  const hash = sent.hash;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const res = await server.getTransaction(hash);
    if (res.status !== Api.GetTransactionStatus.NOT_FOUND) {
      return { hash, status: res.status };
    }
    if (pollIntervalMs > 0) await sleep(pollIntervalMs);
  }

  throw new Error(`Polling for transaction ${hash} timed out after ${maxPolls} attempts.`);
}
