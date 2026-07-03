import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  proposeTransactionSchema,
  addSignatureSchema,
  submitTransactionSchema,
  submitTransactionResponseSchema,
  type ProposeTransactionDto,
  type AddSignatureDto,
  type SubmitTransactionDto,
  type SubmitTransactionResponse,
} from "../src/dtos/pipeline";

describe("ProposeTransactionDto", () => {
  it("parses a valid payload with optional memo omitted", () => {
    const value = { type: "payment", xdr: "AAAA", thresholdLevel: "high" };
    expect(proposeTransactionSchema.parse(value)).toEqual(value);
  });
  it("parses a valid payload with memo", () => {
    const value = {
      type: "config",
      xdr: "AAAA",
      thresholdLevel: "medium",
      memo: "rotate signers",
    };
    expect(proposeTransactionSchema.parse(value)).toEqual(value);
  });
  it("parses a valid payload with confidentialOp", () => {
    const value = {
      type: "confidential",
      xdr: "AAAA",
      thresholdLevel: "high",
      confidentialOp: "transfer",
    };
    expect(proposeTransactionSchema.parse(value)).toEqual(value);
  });
  it("rejects an unknown confidentialOp", () => {
    expect(() =>
      proposeTransactionSchema.parse({
        type: "confidential",
        xdr: "AAAA",
        thresholdLevel: "high",
        confidentialOp: "swap",
      }),
    ).toThrow();
  });
  it("rejects a missing xdr", () => {
    expect(() =>
      proposeTransactionSchema.parse({ type: "payment", thresholdLevel: "low" }),
    ).toThrow();
  });
  it("rejects an unknown type", () => {
    expect(() =>
      proposeTransactionSchema.parse({ type: "swap", xdr: "AAAA", thresholdLevel: "low" }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof proposeTransactionSchema>>().toEqualTypeOf<ProposeTransactionDto>();
  });
});

describe("AddSignatureDto", () => {
  it("parses a valid payload", () => {
    const value = { signerPublicKey: "GABC", signatureXdr: "SIG==" };
    expect(addSignatureSchema.parse(value)).toEqual(value);
  });
  it("rejects an empty signerPublicKey", () => {
    expect(() =>
      addSignatureSchema.parse({ signerPublicKey: "", signatureXdr: "SIG==" }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof addSignatureSchema>>().toEqualTypeOf<AddSignatureDto>();
  });
});

describe("SubmitTransactionDto", () => {
  it("parses an empty object", () => {
    expect(submitTransactionSchema.parse({})).toEqual({});
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof submitTransactionSchema>>().toEqualTypeOf<SubmitTransactionDto>();
  });
});

describe("SubmitTransactionResponse", () => {
  it("parses a valid response", () => {
    const value = { hash: "abc123", status: "submitted" };
    expect(submitTransactionResponseSchema.parse(value)).toEqual(value);
  });
  it("rejects an unknown status", () => {
    expect(() =>
      submitTransactionResponseSchema.parse({ hash: "abc", status: "done" }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof submitTransactionResponseSchema>>().toEqualTypeOf<SubmitTransactionResponse>();
  });
});
