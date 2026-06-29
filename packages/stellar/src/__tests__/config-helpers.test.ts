import { describe, it, expect } from "vitest";
import { Operation, xdr } from "@stellar/stellar-sdk";
import { addSignerOp, setThresholdsOp, disableMasterKeyOp } from "../config-helpers.js";
import { signerB } from "./fixtures.js";

function isSetOptions(op: xdr.Operation): boolean {
  return op.body().switch().name === "setOptions";
}

describe("addSignerOp", () => {
  it("produces a setOptions operation adding an ed25519 signer with the given weight", () => {
    const op = addSignerOp(signerB.publicKey(), 2);
    expect(isSetOptions(op)).toBe(true);
    const so = op.body().setOptionsOp();
    expect(so.signer()).not.toBeNull();
    expect(so.signer()!.weight()).toBe(2);
  });
});

describe("setThresholdsOp", () => {
  it("produces a setOptions operation with low/med/high thresholds", () => {
    const op = setThresholdsOp({ low: 1, medium: 2, high: 3 });
    expect(isSetOptions(op)).toBe(true);
    const so = op.body().setOptionsOp();
    expect(so.lowThreshold()!.toString()).toBe("1");
    expect(so.medThreshold()!.toString()).toBe("2");
    expect(so.highThreshold()!.toString()).toBe("3");
  });
});

describe("disableMasterKeyOp", () => {
  it("produces a setOptions operation setting master weight to 0", () => {
    const op = disableMasterKeyOp();
    expect(isSetOptions(op)).toBe(true);
    const so = op.body().setOptionsOp();
    expect(so.masterWeight()!.toString()).toBe("0");
  });

  it("round-trips as a valid Operation", () => {
    const op = disableMasterKeyOp();
    // fromXDRObject must not throw on our constructed op.
    expect(() => Operation.fromXDRObject(op)).not.toThrow();
  });
});
