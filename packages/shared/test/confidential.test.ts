import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  confidentialOpSchema,
  wrapKeySchema,
  keyEnvelopeSchema,
  openingBlobSchema,
  confidentialRegistrationSchema,
  type WrapKeyDto,
  type KeyEnvelopeDto,
  type OpeningBlobDto,
  type ConfidentialRegistrationDto,
} from "../src/dtos/confidential";

describe("confidentialOpSchema (re-export)", () => {
  it("accepts the confidential ops", () => {
    for (const v of ["register", "deposit", "merge", "transfer", "withdraw"]) {
      expect(confidentialOpSchema.parse(v)).toBe(v);
    }
  });
});

describe("WrapKeyDto", () => {
  it("parses a valid payload", () => {
    const value = { wrapPublicKey: "PK" };
    expect(wrapKeySchema.parse(value)).toEqual(value);
  });
  it("rejects an empty wrapPublicKey", () => {
    expect(() => wrapKeySchema.parse({ wrapPublicKey: "" })).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof wrapKeySchema>>().toEqualTypeOf<WrapKeyDto>();
  });
});

describe("KeyEnvelopeDto", () => {
  it("parses a valid payload", () => {
    const value = { memberPublicKey: "GABC", ciphertext: "CT" };
    expect(keyEnvelopeSchema.parse(value)).toEqual(value);
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof keyEnvelopeSchema>>().toEqualTypeOf<KeyEnvelopeDto>();
  });
});

describe("OpeningBlobDto", () => {
  it("parses a valid payload", () => {
    const value = { eventKey: "EK", ciphertext: "CT" };
    expect(openingBlobSchema.parse(value)).toEqual(value);
  });
  it("infers to the exported type", () => {
    expectTypeOf<z.infer<typeof openingBlobSchema>>().toEqualTypeOf<OpeningBlobDto>();
  });
});

describe("ConfidentialRegistrationDto", () => {
  it("parses a valid payload", () => {
    const value = {
      tokenContract: "CABC",
      auditorId: 0,
      spendingPubKey: "SPK",
    };
    expect(confidentialRegistrationSchema.parse(value)).toEqual(value);
  });
  it("rejects a negative auditorId", () => {
    expect(() =>
      confidentialRegistrationSchema.parse({
        tokenContract: "CABC",
        auditorId: -1,
        spendingPubKey: "SPK",
      }),
    ).toThrow();
  });
  it("rejects an empty tokenContract", () => {
    expect(() =>
      confidentialRegistrationSchema.parse({
        tokenContract: "",
        auditorId: 0,
        spendingPubKey: "SPK",
      }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof confidentialRegistrationSchema>
    >().toEqualTypeOf<ConfidentialRegistrationDto>();
  });
});
