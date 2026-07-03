import { TransactionBuilder } from "@stellar/stellar-sdk";

/** Map of signer public key (G...) -> weight on the multisig account. */
export type SignerWeights = Record<string, number>;

/** A signature collected from a signer, as stored/transported by the pipeline. */
export interface CollectedSignature {
  signerPublicKey: string;
  /** Base64-encoded raw ed25519 signature over the transaction hash. */
  signatureXdr: string;
}

/**
 * Sum the weights contributed by the distinct signers present in `collected`.
 * - Unknown signers (no entry in `weights`) contribute 0.
 * - Duplicate signatures from the same signer are counted once.
 */
export function accumulatedWeight(
  collected: CollectedSignature[],
  weights: SignerWeights,
): number {
  const seen = new Set<string>();
  let total = 0;
  for (const sig of collected) {
    if (seen.has(sig.signerPublicKey)) continue;
    seen.add(sig.signerPublicKey);
    total += weights[sig.signerPublicKey] ?? 0;
  }
  return total;
}

/**
 * True when the accumulated weight of the collected signatures meets or exceeds
 * the required threshold for the operation. The required number is resolved by
 * the pipeline from `account.thresholds[level]` (per the @cluster/shared design).
 */
export function isThresholdMet(
  collected: CollectedSignature[],
  weights: SignerWeights,
  requiredThreshold: number,
): boolean {
  return accumulatedWeight(collected, weights) >= requiredThreshold;
}

/**
 * Combine collected signatures into the transaction envelope and return the
 * fully-signed base64 XDR ready for submission.
 *
 * - Rebuilds the transaction from `xdr` against the given network passphrase.
 * - `Transaction.addSignature` verifies each signature against the tx hash and
 *   throws if it does not match — invalid/mislabeled signatures are rejected.
 * - Signatures are applied in deterministic (public-key-sorted, de-duplicated)
 *   order so the output XDR is stable regardless of input order.
 */
export function combineSignatures(
  xdr: string,
  collected: CollectedSignature[],
  networkPassphrase: string,
): string {
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);

  const seen = new Set<string>();
  const ordered = [...collected]
    .filter((s) => {
      if (seen.has(s.signerPublicKey)) return false;
      seen.add(s.signerPublicKey);
      return true;
    })
    .sort((a, b) => a.signerPublicKey.localeCompare(b.signerPublicKey));

  for (const sig of ordered) {
    // Verifies signature against tx hash; throws on mismatch.
    tx.addSignature(sig.signerPublicKey, sig.signatureXdr);
  }

  return tx.toXDR();
}
