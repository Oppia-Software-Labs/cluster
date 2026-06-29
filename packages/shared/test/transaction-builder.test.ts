import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  builtTransactionSchema,
  type BuiltTransaction,
  type TransactionBuilder,
} from "../src/transaction-builder";

describe("BuiltTransaction", () => {
  it("parses a valid built transaction", () => {
    const value = {
      xdr: "AAAAAgAAAAA",
      type: "payment",
      thresholdLevel: "medium",
    };
    expect(builtTransactionSchema.parse(value)).toEqual(value);
  });

  it("rejects an unknown type", () => {
    expect(() =>
      builtTransactionSchema.parse({
        xdr: "x",
        type: "swap",
        thresholdLevel: "low",
      }),
    ).toThrow();
  });

  it("rejects an unknown thresholdLevel", () => {
    expect(() =>
      builtTransactionSchema.parse({
        xdr: "x",
        type: "payment",
        thresholdLevel: "critical",
      }),
    ).toThrow();
  });

  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof builtTransactionSchema>>().toEqualTypeOf<BuiltTransaction>();
  });
});

describe("TransactionBuilder", () => {
  it("can be implemented and returns a BuiltTransaction", async () => {
    const builder: TransactionBuilder<{ to: string }> = {
      async build(input) {
        return { xdr: input.to, type: "payment", thresholdLevel: "low" };
      },
    };
    const result = await builder.build({ to: "GABC" });
    expect(result.type).toBe("payment");
    expectTypeOf(result).toEqualTypeOf<BuiltTransaction>();
  });
});
