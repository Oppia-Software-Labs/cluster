import { describe, it, expect, expectTypeOf } from "vitest";
import {
  transactionTypeSchema,
  transactionStatusSchema,
  thresholdLevelSchema,
  memberRoleSchema,
  type TransactionType,
  type TransactionStatus,
  type ThresholdLevel,
  type MemberRole,
} from "../src/enums";

describe("TransactionType", () => {
  it("accepts payment | config | trade | trustline", () => {
    expect(transactionTypeSchema.parse("payment")).toBe("payment");
    expect(transactionTypeSchema.parse("config")).toBe("config");
    expect(transactionTypeSchema.parse("trade")).toBe("trade");
    expect(transactionTypeSchema.parse("trustline")).toBe("trustline");
    expect(transactionTypeSchema.parse("vault_deposit")).toBe("vault_deposit");
    expect(transactionTypeSchema.parse("vault_withdraw")).toBe("vault_withdraw");
  });
  it("rejects unknown values", () => {
    expect(() => transactionTypeSchema.parse("swap")).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<TransactionType>().toEqualTypeOf<
      "payment" | "config" | "trade" | "trustline" | "vault_deposit" | "vault_withdraw"
    >();
  });
});

describe("TransactionStatus", () => {
  it("accepts pending | ready | submitted | failed", () => {
    for (const v of ["pending", "ready", "submitted", "failed"]) {
      expect(transactionStatusSchema.parse(v)).toBe(v);
    }
  });
  it("rejects unknown values", () => {
    expect(() => transactionStatusSchema.parse("done")).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<TransactionStatus>().toEqualTypeOf<
      "pending" | "ready" | "submitted" | "failed"
    >();
  });
});

describe("ThresholdLevel", () => {
  it("accepts low | medium | high", () => {
    for (const v of ["low", "medium", "high"]) {
      expect(thresholdLevelSchema.parse(v)).toBe(v);
    }
  });
  it("rejects unknown values", () => {
    expect(() => thresholdLevelSchema.parse("critical")).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<ThresholdLevel>().toEqualTypeOf<"low" | "medium" | "high">();
  });
});

describe("MemberRole", () => {
  it("accepts owner | admin | member", () => {
    for (const v of ["owner", "admin", "member"]) {
      expect(memberRoleSchema.parse(v)).toBe(v);
    }
  });
  it("rejects unknown values", () => {
    expect(() => memberRoleSchema.parse("guest")).toThrow();
  });
  it("infers to the exported type", () => {
    expectTypeOf<MemberRole>().toEqualTypeOf<"owner" | "admin" | "member">();
  });
});
