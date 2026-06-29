import { Operation, xdr } from "@stellar/stellar-sdk";

export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

/**
 * Build a set_options operation that adds (or re-weights) an ed25519 signer.
 * Setting `weight` to 0 REMOVES the signer.
 */
export function addSignerOp(signerPublicKey: string, weight: number): xdr.Operation {
  return Operation.setOptions({
    signer: {
      ed25519PublicKey: signerPublicKey,
      weight,
    },
  });
}

/**
 * Build a set_options operation that sets the low/medium/high signing thresholds.
 * The chain enforces these per operation category once applied.
 */
export function setThresholdsOp(thresholds: Thresholds): xdr.Operation {
  return Operation.setOptions({
    lowThreshold: thresholds.low,
    medThreshold: thresholds.medium,
    highThreshold: thresholds.high,
  });
}

/**
 * ⚠️ IRREVERSIBLE — DANGER. Build a set_options operation that sets the master
 * key weight to 0, permanently disabling the account's original key.
 *
 * MAINNET = REAL FUNDS. Once this operation is submitted and confirmed, the
 * master key can NEVER sign again. If the remaining signer set + thresholds are
 * misconfigured (e.g. thresholds higher than the total added signer weight),
 * the account becomes PERMANENTLY LOCKED and the funds are UNRECOVERABLE.
 *
 * Callers MUST verify, before submitting any transaction containing this op,
 * that the new signer weights can satisfy every threshold level. This helper
 * intentionally does no funds movement — it only constructs the operation.
 */
export function disableMasterKeyOp(): xdr.Operation {
  return Operation.setOptions({ masterWeight: 0 });
}
