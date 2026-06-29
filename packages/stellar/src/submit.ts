import { TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";

export interface SubmitOptions {
  /** RPC server (real or mocked). Defaults to a server from getRpcServer() if omitted. */
  server: rpc.Server;
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
  const { server, networkPassphrase, pollIntervalMs = 2000, maxPolls = 30 } = options;

  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sent = await server.sendTransaction(tx as any);

  if (sent.status === "ERROR") {
    throw new Error(
      `sendTransaction returned ERROR for ${sent.hash}: ${JSON.stringify(sent.errorResult ?? {})}`,
    );
  }

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
