import { describe, it, expect } from "vitest";
import {
  BASE_FEE,
  Keypair,
  TransactionBuilder,
  Transaction,
} from "@stellar/stellar-sdk";
import {
  buildCreateAccountTx,
  assertThresholdsSatisfiable,
  buildAddMemberTx,
  buildRemoveMemberTx,
  buildSetThresholdsTx,
  type AccountMemberInput,
} from "../builders/config.js";
import { MAINNET_NETWORK_PASSPHRASE as NETWORK_PASSPHRASE } from "../network.js";
import { signerA, signerB, signerC } from "./fixtures.js";

const creator = Keypair.random();
const newAccount = Keypair.random();

const members: AccountMemberInput[] = [
  { publicKey: signerA.publicKey(), weight: 2 },
  { publicKey: signerB.publicKey(), weight: 1 },
  { publicKey: signerC.publicKey(), weight: 1 },
];
const thresholds = { low: 1, medium: 2, high: 3 };

function parse(xdr: string): Transaction {
  return TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE) as Transaction;
}

function createXdr(overrides: Partial<Parameters<typeof buildCreateAccountTx>[0]> = {}) {
  return buildCreateAccountTx({
    creatorPublicKey: creator.publicKey(),
    creatorSequence: "100",
    newAccountPublicKey: newAccount.publicKey(),
    members,
    thresholds,
    startingBalance: "5",
    ...overrides,
  });
}

describe("buildCreateAccountTx", () => {
  it("sources the transaction from the creator (the funder)", () => {
    const tx = parse(createXdr());
    expect(tx.source).toBe(creator.publicKey());
  });

  it("emits createAccount → signers → thresholds → disable-master, in order", () => {
    const ops = parse(createXdr()).operations as any[];
    // 1 createAccount + 3 signers + 1 thresholds + 1 disable-master
    expect(ops).toHaveLength(members.length + 3);

    expect(ops[0].type).toBe("createAccount");
    expect(ops[0].destination).toBe(newAccount.publicKey());
    expect(parseFloat(ops[0].startingBalance)).toBe(5);
    // createAccount has no op-level source: it runs as the creator (tx source).
    expect(ops[0].source).toBeUndefined();

    // signer ops
    members.forEach((m, i) => {
      const op = ops[1 + i];
      expect(op.type).toBe("setOptions");
      expect(op.source).toBe(newAccount.publicKey());
      expect(op.signer.ed25519PublicKey).toBe(m.publicKey);
      expect(op.signer.weight).toBe(m.weight);
    });

    const thresholdOp = ops[members.length + 1];
    expect(thresholdOp.type).toBe("setOptions");
    expect(thresholdOp.source).toBe(newAccount.publicKey());
    expect(thresholdOp.lowThreshold).toBe(1);
    expect(thresholdOp.medThreshold).toBe(2);
    expect(thresholdOp.highThreshold).toBe(3);

    const disableOp = ops[members.length + 2];
    expect(disableOp.type).toBe("setOptions");
    expect(disableOp.source).toBe(newAccount.publicKey());
    expect(disableOp.masterWeight).toBe(0);
  });

  it("targets every set_options op at the new account, never the creator", () => {
    const ops = parse(createXdr()).operations as any[];
    const setOptionsOps = ops.filter((o) => o.type === "setOptions");
    expect(setOptionsOps.length).toBeGreaterThan(0);
    for (const op of setOptionsOps) {
      expect(op.source).toBe(newAccount.publicKey());
      expect(op.source).not.toBe(creator.publicKey());
    }
  });

  it("charges a per-operation base fee (total = ops × BASE_FEE)", () => {
    const tx = parse(createXdr());
    const opCount = members.length + 3;
    expect(tx.fee).toBe((opCount * Number(BASE_FEE)).toString());
  });

  it("produces an unsigned tx that both the creator and new account can sign", () => {
    const tx = parse(createXdr());
    expect(tx.signatures).toHaveLength(0);
    tx.sign(creator, newAccount);
    expect(tx.signatures).toHaveLength(2);
  });

  it("refuses to build a self-locking configuration", () => {
    // high threshold 99 exceeds total weight (4) → would lock the account forever.
    expect(() => createXdr({ thresholds: { low: 1, medium: 2, high: 99 } })).toThrow(
      /permanently locked/i,
    );
  });
});

describe("assertThresholdsSatisfiable", () => {
  it("passes when total signer weight covers every threshold", () => {
    expect(() => assertThresholdsSatisfiable(members, thresholds)).not.toThrow();
  });

  it("throws when any threshold exceeds the total signer weight", () => {
    expect(() =>
      assertThresholdsSatisfiable(members, { low: 1, medium: 2, high: 5 }),
    ).toThrow(/high threshold/i);
  });

  it("rejects an empty signer set", () => {
    expect(() => assertThresholdsSatisfiable([], thresholds)).toThrow(/at least one signer/i);
  });

  it("rejects non-positive weights", () => {
    expect(() =>
      assertThresholdsSatisfiable([{ publicKey: signerA.publicKey(), weight: 0 }], { low: 0, medium: 0, high: 0 }),
    ).toThrow(/positive integer weight/i);
  });
});

describe("config-change builders", () => {
  const ctx = { accountPublicKey: newAccount.publicKey(), sequence: "200" };

  it("buildAddMemberTx emits a config tx adding a weighted signer", () => {
    const built = buildAddMemberTx(ctx, { publicKey: signerA.publicKey(), weight: 3 });
    expect(built.type).toBe("config");
    expect(built.thresholdLevel).toBe("high");
    const op = (parse(built.xdr).operations as any[])[0];
    expect(op.type).toBe("setOptions");
    expect(op.signer.ed25519PublicKey).toBe(signerA.publicKey());
    expect(op.signer.weight).toBe(3);
  });

  it("buildRemoveMemberTx removes a signer via weight 0", () => {
    const built = buildRemoveMemberTx(ctx, signerB.publicKey());
    const op = (parse(built.xdr).operations as any[])[0];
    expect(op.signer.ed25519PublicKey).toBe(signerB.publicKey());
    expect(op.signer.weight).toBe(0);
  });

  it("buildSetThresholdsTx updates low/medium/high", () => {
    const built = buildSetThresholdsTx(ctx, { low: 2, medium: 3, high: 4 });
    const op = (parse(built.xdr).operations as any[])[0];
    expect(op.lowThreshold).toBe(2);
    expect(op.medThreshold).toBe(3);
    expect(op.highThreshold).toBe(4);
  });
});
