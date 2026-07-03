import { describe, it, expect } from "vitest";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import {
  accumulatedWeight,
  isThresholdMet,
  combineSignatures,
  type CollectedSignature,
  type SignerWeights,
} from "../signatures.js";
import { MAINNET_NETWORK_PASSPHRASE as NETWORK_PASSPHRASE } from "../network.js";
import { signerA, signerB, signerC, buildUnsignedXdr, signatureFor } from "./fixtures.js";

const weights: SignerWeights = {
  [signerA.publicKey()]: 1,
  [signerB.publicKey()]: 2,
  [signerC.publicKey()]: 1,
};

describe("accumulatedWeight", () => {
  it("sums the weights of present signers", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerA.publicKey(), signatureXdr: "x" },
      { signerPublicKey: signerB.publicKey(), signatureXdr: "y" },
    ];
    expect(accumulatedWeight(collected, weights)).toBe(3);
  });

  it("ignores signers with no weight entry (unknown signer = 0)", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: "GUNKNOWN", signatureXdr: "z" },
      { signerPublicKey: signerA.publicKey(), signatureXdr: "x" },
    ];
    expect(accumulatedWeight(collected, weights)).toBe(1);
  });

  it("does not double-count duplicate signatures from the same signer", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerB.publicKey(), signatureXdr: "y1" },
      { signerPublicKey: signerB.publicKey(), signatureXdr: "y2" },
    ];
    expect(accumulatedWeight(collected, weights)).toBe(2);
  });

  it("returns 0 for no signatures", () => {
    expect(accumulatedWeight([], weights)).toBe(0);
  });
});

describe("isThresholdMet", () => {
  it("is true when accumulated weight >= required threshold", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerB.publicKey(), signatureXdr: "y" },
    ];
    expect(isThresholdMet(collected, weights, 2)).toBe(true);
  });

  it("is true on exact equality (boundary)", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerA.publicKey(), signatureXdr: "x" },
    ];
    expect(isThresholdMet(collected, weights, 1)).toBe(true);
  });

  it("is false when below threshold", () => {
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerA.publicKey(), signatureXdr: "x" },
    ];
    expect(isThresholdMet(collected, weights, 3)).toBe(false);
  });
});

describe("combineSignatures", () => {
  it("attaches all collected signatures to the envelope and round-trips through XDR", () => {
    const xdr = buildUnsignedXdr();
    const collected: CollectedSignature[] = [
      { signerPublicKey: signerA.publicKey(), signatureXdr: signatureFor(xdr, signerA) },
      { signerPublicKey: signerB.publicKey(), signatureXdr: signatureFor(xdr, signerB) },
    ];

    const combinedXdr = combineSignatures(xdr, collected, NETWORK_PASSPHRASE);
    const tx = TransactionBuilder.fromXDR(combinedXdr, NETWORK_PASSPHRASE);

    expect(tx.signatures).toHaveLength(2);
  });

  it("rejects a signature that does not verify against the transaction", () => {
    const xdr = buildUnsignedXdr();
    // signerC signs, but we mislabel it as signerA -> addSignature must reject.
    const bad: CollectedSignature[] = [
      { signerPublicKey: signerA.publicKey(), signatureXdr: signatureFor(xdr, signerC) },
    ];
    expect(() => combineSignatures(xdr, bad, NETWORK_PASSPHRASE)).toThrow();
  });

  it("produces a deterministic combined XDR regardless of input order", () => {
    const xdr = buildUnsignedXdr();
    const sigA = { signerPublicKey: signerA.publicKey(), signatureXdr: signatureFor(xdr, signerA) };
    const sigB = { signerPublicKey: signerB.publicKey(), signatureXdr: signatureFor(xdr, signerB) };

    const ab = combineSignatures(xdr, [sigA, sigB], NETWORK_PASSPHRASE);
    const ba = combineSignatures(xdr, [sigB, sigA], NETWORK_PASSPHRASE);
    expect(ab).toBe(ba);
  });
});
