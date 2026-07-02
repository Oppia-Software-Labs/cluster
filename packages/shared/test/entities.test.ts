import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  createUserSchema,
  userSchema,
  type CreateUserDto,
  type User,
} from "../src/dtos/user";
import {
  createMultisigAccountSchema,
  multisigAccountSchema,
  type CreateMultisigAccountDto,
  type MultisigAccount,
} from "../src/dtos/multisig-account";
import {
  createAccountMemberSchema,
  accountMemberSchema,
  type CreateAccountMemberDto,
  type AccountMember,
} from "../src/dtos/account-member";
import {
  createTransactionSchema,
  transactionSchema,
  type CreateTransactionDto,
  type Transaction,
} from "../src/dtos/transaction";
import {
  createSignatureSchema,
  signatureSchema,
  type CreateSignatureDto,
  type Signature,
} from "../src/dtos/signature";

describe("User", () => {
  it("parses create + read shapes", () => {
    expect(createUserSchema.parse({ publicKey: "GABC" })).toEqual({ publicKey: "GABC" });
    const read = { publicKey: "GABC", displayName: "Mat", avatarUrl: null };
    expect(userSchema.parse(read)).toEqual(read);
  });
  it("rejects an empty publicKey", () => {
    expect(() => createUserSchema.parse({ publicKey: "" })).toThrow();
  });
  it("infers create + read types", () => {
    expectTypeOf<z.infer<typeof createUserSchema>>().toEqualTypeOf<CreateUserDto>();
    expectTypeOf<z.infer<typeof userSchema>>().toEqualTypeOf<User>();
  });
});

describe("MultisigAccount", () => {
  const create = {
    name: "Treasury",
    stellarAccountId: "GACCT",
    createdBy: "GABC",
    thresholds: { low: 1, medium: 2, high: 3 },
  };
  it("parses create + read shapes", () => {
    expect(createMultisigAccountSchema.parse(create)).toEqual(create);
    const read = { id: "uuid-1", network: "mainnet", ...create };
    expect(multisigAccountSchema.parse(read)).toEqual(read);
  });
  it("rejects a non-integer threshold", () => {
    expect(() =>
      createMultisigAccountSchema.parse({ ...create, thresholds: { low: 1.5, medium: 2, high: 3 } }),
    ).toThrow();
  });
  it("infers create + read types", () => {
    expectTypeOf<z.infer<typeof createMultisigAccountSchema>>().toEqualTypeOf<CreateMultisigAccountDto>();
    expectTypeOf<z.infer<typeof multisigAccountSchema>>().toEqualTypeOf<MultisigAccount>();
  });
});

describe("AccountMember", () => {
  const create = { accountId: "uuid-1", publicKey: "GABC", weight: 1, role: "owner" };
  it("parses create + read shapes", () => {
    expect(createAccountMemberSchema.parse(create)).toEqual(create);
    const read = { id: "uuid-m", ...create };
    expect(accountMemberSchema.parse(read)).toEqual(read);
  });
  it("rejects an unknown role", () => {
    expect(() => createAccountMemberSchema.parse({ ...create, role: "guest" })).toThrow();
  });
  it("infers create + read types", () => {
    expectTypeOf<z.infer<typeof createAccountMemberSchema>>().toEqualTypeOf<CreateAccountMemberDto>();
    expectTypeOf<z.infer<typeof accountMemberSchema>>().toEqualTypeOf<AccountMember>();
  });
});

describe("Transaction", () => {
  const create = {
    accountId: "uuid-1",
    type: "payment",
    xdr: "AAAA",
    thresholdLevel: "medium",
    memo: "rent",
  };
  it("parses create + read shapes", () => {
    expect(createTransactionSchema.parse(create)).toEqual(create);
    const read = {
      id: "uuid-tx",
      accountId: "uuid-1",
      type: "payment",
      xdr: "AAAA",
      status: "pending",
      requiredThreshold: 2,
      proposedBy: "GABC",
      memo: null,
      submittedHash: null,
      lastError: null,
    };
    expect(transactionSchema.parse(read)).toEqual(read);
  });
  it("rejects an unknown status on read", () => {
    expect(() =>
      transactionSchema.parse({
        id: "x",
        accountId: "x",
        type: "payment",
        xdr: "AAAA",
        status: "done",
        requiredThreshold: 2,
        proposedBy: "GABC",
        submittedHash: null,
      }),
    ).toThrow();
  });
  it("infers create + read types", () => {
    expectTypeOf<z.infer<typeof createTransactionSchema>>().toEqualTypeOf<CreateTransactionDto>();
    expectTypeOf<z.infer<typeof transactionSchema>>().toEqualTypeOf<Transaction>();
  });
});

describe("Signature", () => {
  const create = {
    transactionId: "uuid-tx",
    signerPublicKey: "GABC",
    signatureXdr: "SIG==",
    weight: 1,
  };
  it("parses create + read shapes", () => {
    expect(createSignatureSchema.parse(create)).toEqual(create);
    const read = { id: "uuid-sig", ...create };
    expect(signatureSchema.parse(read)).toEqual(read);
  });
  it("rejects a negative weight", () => {
    expect(() => createSignatureSchema.parse({ ...create, weight: -1 })).toThrow();
  });
  it("infers create + read types", () => {
    expectTypeOf<z.infer<typeof createSignatureSchema>>().toEqualTypeOf<CreateSignatureDto>();
    expectTypeOf<z.infer<typeof signatureSchema>>().toEqualTypeOf<Signature>();
  });
});
