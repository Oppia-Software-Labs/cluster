/**
 * Signer-side decrypt of a proposed confidential transfer payload (spec §6.4).
 *
 * The proposer attached this payload encrypted under the account's shared
 * `k_store`, so any member who can unlock `sk` can review the plaintext
 * amount before signing. The server only ever stored ciphertext.
 */

import { decryptOpening, hexToBytes } from "@cluster/zk";

import { stroopsToXlm } from "./chain";
import type { ConfidentialPayloadV1 } from "./propose";

export interface DecryptedTransferDetail {
  amountStroops: bigint;
  /** Human XLM string (via stroopsToXlm). */
  amount: string;
  recipient: string;
}

/**
 * Decode and decrypt a base64 {@link ConfidentialPayloadV1} using the
 * account's unlocked storage key. Returns `null` when the version tag is
 * wrong, JSON parsing fails, or decryption throws (tamper / wrong key).
 */
export function decryptProposedTransfer(
  payloadB64: string,
  kStore: Uint8Array,
): DecryptedTransferDetail | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(payloadB64));
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as ConfidentialPayloadV1).v !== 1 ||
    typeof (parsed as ConfidentialPayloadV1).cipherHex !== "string" ||
    typeof (parsed as ConfidentialPayloadV1).recipient !== "string"
  ) {
    return null;
  }

  const { cipherHex, recipient } = parsed as ConfidentialPayloadV1;

  try {
    const opening = decryptOpening(hexToBytes(cipherHex), kStore);
    const amountStroops = opening.v;
    return {
      amountStroops,
      amount: stroopsToXlm(amountStroops),
      recipient,
    };
  } catch {
    return null;
  }
}
