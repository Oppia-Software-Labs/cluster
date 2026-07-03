import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  confidentialOpSchema,
  wrapKeySchema,
  keyEnvelopeSchema,
  openingBlobSchema,
  confidentialRegistrationSchema,
  wrapKeyResponseSchema,
  keyEnvelopeResponseSchema,
  openingBlobResponseSchema,
  registrationResponseSchema,
  advanceRegistrationSchema,
  type WrapKeyDto,
  type KeyEnvelopeDto,
  type OpeningBlobDto,
  type ConfidentialRegistrationDto,
  type WrapKeyResponse,
  type KeyEnvelopeResponse,
  type OpeningBlobResponse,
  type RegistrationResponse,
  type AdvanceRegistrationDto,
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

describe("WrapKeyResponse", () => {
  it("parses a valid payload", () => {
    const value = { userPublicKey: "GABC", wrapPublicKey: "PK" };
    expect(wrapKeyResponseSchema.parse(value)).toEqual(value);
  });
  it("rejects a missing wrapPublicKey", () => {
    expect(() => wrapKeyResponseSchema.parse({ userPublicKey: "GABC" })).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof wrapKeyResponseSchema>
    >().toEqualTypeOf<WrapKeyResponse>();
  });
});

describe("KeyEnvelopeResponse", () => {
  it("parses a valid payload", () => {
    const value = { accountId: "acc1", memberPublicKey: "GABC", ciphertext: "CT" };
    expect(keyEnvelopeResponseSchema.parse(value)).toEqual(value);
  });
  it("rejects a missing accountId", () => {
    expect(() =>
      keyEnvelopeResponseSchema.parse({ memberPublicKey: "GABC", ciphertext: "CT" }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof keyEnvelopeResponseSchema>
    >().toEqualTypeOf<KeyEnvelopeResponse>();
  });
});

describe("OpeningBlobResponse", () => {
  it("parses a valid payload", () => {
    const value = { accountId: "acc1", eventKey: "EK", ciphertext: "CT" };
    expect(openingBlobResponseSchema.parse(value)).toEqual(value);
  });
  it("rejects a missing ciphertext", () => {
    expect(() =>
      openingBlobResponseSchema.parse({ accountId: "acc1", eventKey: "EK" }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof openingBlobResponseSchema>
    >().toEqualTypeOf<OpeningBlobResponse>();
  });
});

describe("RegistrationResponse", () => {
  it("parses a valid payload", () => {
    const value = {
      accountId: "acc1",
      tokenContract: "CABC",
      auditorId: 1,
      status: "pending" as const,
      spendingPubKey: "SPK",
    };
    expect(registrationResponseSchema.parse(value)).toEqual(value);
  });
  it("rejects an unknown status", () => {
    expect(() =>
      registrationResponseSchema.parse({
        accountId: "acc1",
        tokenContract: "CABC",
        auditorId: 1,
        status: "nope",
        spendingPubKey: "SPK",
      }),
    ).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof registrationResponseSchema>
    >().toEqualTypeOf<RegistrationResponse>();
  });
});

describe("AdvanceRegistrationDto", () => {
  it("accepts the registration statuses", () => {
    expect(advanceRegistrationSchema.parse({ status: "pending" })).toEqual({
      status: "pending",
    });
    expect(advanceRegistrationSchema.parse({ status: "registered" })).toEqual({
      status: "registered",
    });
  });
  it("rejects an unknown status", () => {
    expect(() => advanceRegistrationSchema.parse({ status: "done" })).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<
      z.infer<typeof advanceRegistrationSchema>
    >().toEqualTypeOf<AdvanceRegistrationDto>();
  });
});
