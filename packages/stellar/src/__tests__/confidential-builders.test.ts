import { describe, it, expect, vi } from "vitest";
import {
  Account,
  Address,
  Networks,
  Transaction,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { builtTransactionSchema } from "@cluster/shared";
import {
  buildRegisterTx,
  buildDepositTx,
  buildMergeTx,
  buildTransferTx,
  buildWithdrawTx,
  type ConfidentialBuilt,
  type ConfidentialTxBase,
} from "../builders/confidential.js";
import type { SorobanContext } from "../soroban.js";
import { mockRpcServer, mockSimulationSuccess } from "./fixtures.js";

const PASSPHRASE = Networks.TESTNET;
const ACCOUNT = "GDNSSYSCSSJ76FER5WEEXME5G4MTCUBKDRQSKOYP36KUKVDB2VCMERS6";
const RECIPIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/**
 * Cross-package seam fixture (plan §5.3.6): a hex-pinned fake `{payload,proof}`
 * envelope, asserted to pass through byte-for-byte. Mirrored (by agreement) in
 * `@cluster/zk`'s codec tests — if either the codec framing or the builder's
 * pass-through changes, both suites break loudly.
 */
const SEAM_ENVELOPE_HEX = "0badc0de00010203facefeed0000ffff112233445566778899aabbcc";
const SEAM_ENVELOPE = Uint8Array.from(Buffer.from(SEAM_ENVELOPE_HEX, "hex"));

const DATA = Uint8Array.from([1, 2, 3, 4, 5]);

function makeCtx(overrides: {
  simulation?: ReturnType<typeof mockSimulationSuccess>;
  getAccount?: (source: string) => Promise<Account>;
} = {}): SorobanContext {
  const server = mockRpcServer({
    simulation: overrides.simulation ?? mockSimulationSuccess(),
    getAccount: overrides.getAccount,
    account: new Account(ACCOUNT, "100"),
  });
  return {
    rpcServer: server as unknown as SorobanContext["rpcServer"],
    networkPassphrase: PASSPHRASE,
  };
}

function base(soroban: SorobanContext): ConfidentialTxBase {
  return { account: ACCOUNT, contractId: CONTRACT, soroban };
}

/** Decode the invokeContract host function from an assembled envelope XDR. */
function decodeInvoke(builtXdr: string): {
  functionName: string;
  args: xdr.ScVal[];
  txSource: string;
} {
  const tx = TransactionBuilder.fromXDR(builtXdr, PASSPHRASE) as Transaction;
  const op = (tx as any).toEnvelope().v1().tx().operations()[0];
  const invoke = op
    .body()
    .invokeHostFunctionOp()
    .hostFunction()
    .invokeContract();
  return {
    functionName: invoke.functionName().toString(),
    args: invoke.args() as xdr.ScVal[],
    txSource: tx.source,
  };
}

/** Byte-for-byte compare of an scvBytes ScVal against the source bytes. */
function bytesArgEqual(arg: xdr.ScVal, expected: Uint8Array): boolean {
  return Buffer.compare(arg.bytes(), Buffer.from(expected)) === 0;
}

describe("confidential builders — decoded XDR: function name, arg count/types/values", () => {
  it("register → register(account, u32 auditorId, bytes data)", async () => {
    const soroban = makeCtx();
    const built = await buildRegisterTx({
      ...base(soroban),
      auditorId: 7,
      data: DATA,
    });
    const { functionName, args, txSource } = decodeInvoke(built.xdr);
    expect(functionName).toBe("register");
    expect(txSource).toBe(ACCOUNT);
    expect(args).toHaveLength(3);
    expect(scValToNative(args[0]!)).toBe(ACCOUNT);
    expect(scValToNative(args[1]!)).toBe(7); // u32
    expect(bytesArgEqual(args[2]!, DATA)).toBe(true);
  });

  it("deposit → deposit(account, account, i128 amount) [from === to === account]", async () => {
    const soroban = makeCtx();
    const built = await buildDepositTx({
      ...base(soroban),
      amountStroops: 12345678901234567890n,
    });
    const { functionName, args } = decodeInvoke(built.xdr);
    expect(functionName).toBe("deposit");
    expect(args).toHaveLength(3);
    expect(scValToNative(args[0]!)).toBe(ACCOUNT);
    expect(scValToNative(args[1]!)).toBe(ACCOUNT);
    expect(scValToNative(args[2]!)).toBe(12345678901234567890n); // i128 bigint
  });

  it("merge → merge(account) with EXACTLY ONE arg (regression: no proof)", async () => {
    const soroban = makeCtx();
    const built = await buildMergeTx(base(soroban));
    const { functionName, args } = decodeInvoke(built.xdr);
    expect(functionName).toBe("merge");
    expect(args).toHaveLength(1);
    expect(scValToNative(args[0]!)).toBe(ACCOUNT);
  });

  it("transfer → confidential_transfer(account, recipient, bytes data)", async () => {
    const soroban = makeCtx();
    const built = await buildTransferTx({
      ...base(soroban),
      recipient: RECIPIENT,
      data: DATA,
    });
    const { functionName, args } = decodeInvoke(built.xdr);
    expect(functionName).toBe("confidential_transfer");
    expect(args).toHaveLength(3);
    expect(scValToNative(args[0]!)).toBe(ACCOUNT);
    expect(scValToNative(args[1]!)).toBe(RECIPIENT);
    expect(bytesArgEqual(args[2]!, DATA)).toBe(true);
  });

  it("withdraw → withdraw(account, to, i128 amount, bytes data)", async () => {
    const soroban = makeCtx();
    const built = await buildWithdrawTx({
      ...base(soroban),
      amountStroops: 999n,
      data: DATA,
    });
    const { functionName, args } = decodeInvoke(built.xdr);
    expect(functionName).toBe("withdraw");
    expect(args).toHaveLength(4);
    expect(scValToNative(args[0]!)).toBe(ACCOUNT);
    expect(scValToNative(args[1]!)).toBe(ACCOUNT); // defaults to account
    expect(scValToNative(args[2]!)).toBe(999n);
    expect(bytesArgEqual(args[3]!, DATA)).toBe(true);
  });
});

describe("confidential builders — withdraw destination", () => {
  it("defaults `to` to account when destination omitted", async () => {
    const built = await buildWithdrawTx({
      ...base(makeCtx()),
      amountStroops: 5n,
      data: DATA,
    });
    const { args } = decodeInvoke(built.xdr);
    expect(scValToNative(args[1]!)).toBe(ACCOUNT);
  });

  it("honors an explicit destination", async () => {
    const built = await buildWithdrawTx({
      ...base(makeCtx()),
      destination: RECIPIENT,
      amountStroops: 5n,
      data: DATA,
    });
    const { args } = decodeInvoke(built.xdr);
    expect(scValToNative(args[1]!)).toBe(RECIPIENT);
  });
});

describe("confidential builders — envelope shape", () => {
  const cases: Array<{
    name: string;
    op: string;
    run: (soroban: SorobanContext) => Promise<ConfidentialBuilt>;
  }> = [
    {
      name: "register",
      op: "register",
      run: (s) => buildRegisterTx({ ...base(s), auditorId: 1, data: DATA }),
    },
    {
      name: "deposit",
      op: "deposit",
      run: (s) => buildDepositTx({ ...base(s), amountStroops: 10n }),
    },
    { name: "merge", op: "merge", run: (s) => buildMergeTx(base(s)) },
    {
      name: "transfer",
      op: "transfer",
      run: (s) =>
        buildTransferTx({ ...base(s), recipient: RECIPIENT, data: DATA }),
    },
    {
      name: "withdraw",
      op: "withdraw",
      run: (s) => buildWithdrawTx({ ...base(s), amountStroops: 10n, data: DATA }),
    },
  ];

  for (const { name, op, run } of cases) {
    it(`${name}: type/threshold/confidentialOp/simulation + passes builtTransactionSchema`, async () => {
      const built = await run(makeCtx());
      expect(built.type).toBe("confidential");
      expect(built.thresholdLevel).toBe("medium");
      expect(built.confidentialOp).toBe(op);
      expect(built.simulation.minResourceFee).toBe("1000000");
      // The BuiltTransaction portion validates against the shared schema.
      expect(() => builtTransactionSchema.parse(built)).not.toThrow();
    });
  }
});

describe("confidential builders — cross-package seam (opaque byte pass-through)", () => {
  it("register passes the hex-pinned envelope through byte-for-byte", async () => {
    const built = await buildRegisterTx({
      ...base(makeCtx()),
      auditorId: 3,
      data: SEAM_ENVELOPE,
    });
    const { args } = decodeInvoke(built.xdr);
    expect(bytesArgEqual(args[2]!, SEAM_ENVELOPE)).toBe(true);
    // Also assert against the raw hex source so a codec framing change is loud.
    expect(args[2]!.bytes().toString("hex")).toBe(SEAM_ENVELOPE_HEX);
  });

  it("transfer and withdraw pass the same envelope through unchanged", async () => {
    const t = await buildTransferTx({
      ...base(makeCtx()),
      recipient: RECIPIENT,
      data: SEAM_ENVELOPE,
    });
    const w = await buildWithdrawTx({
      ...base(makeCtx()),
      amountStroops: 1n,
      data: SEAM_ENVELOPE,
    });
    expect(decodeInvoke(t.xdr).args[2]!.bytes().toString("hex")).toBe(
      SEAM_ENVELOPE_HEX,
    );
    expect(decodeInvoke(w.xdr).args[3]!.bytes().toString("hex")).toBe(
      SEAM_ENVELOPE_HEX,
    );
  });
});

describe("confidential builders — validation BEFORE any RPC call", () => {
  /** A ctx whose getAccount/simulateTransaction are spies that must NOT run. */
  function spyCtx(): { soroban: SorobanContext; getAccount: ReturnType<typeof vi.fn>; simulate: ReturnType<typeof vi.fn> } {
    const getAccount = vi.fn(async () => new Account(ACCOUNT, "100"));
    const simulate = vi.fn(async () => mockSimulationSuccess());
    const soroban = {
      rpcServer: { getAccount, simulateTransaction: simulate } as unknown as SorobanContext["rpcServer"],
      networkPassphrase: PASSPHRASE,
    };
    return { soroban, getAccount, simulate };
  }

  it("register: invalid account throws before RPC", async () => {
    const { soroban, getAccount, simulate } = spyCtx();
    await expect(
      buildRegisterTx({ account: "not-a-key", contractId: CONTRACT, soroban, auditorId: 1, data: DATA }),
    ).rejects.toThrow(/Invalid account/);
    expect(getAccount).not.toHaveBeenCalled();
    expect(simulate).not.toHaveBeenCalled();
  });

  it("register: invalid contractId throws before RPC", async () => {
    const { soroban, getAccount } = spyCtx();
    await expect(
      buildRegisterTx({ account: ACCOUNT, contractId: "CBAD", soroban, auditorId: 1, data: DATA }),
    ).rejects.toThrow(/Invalid contract/);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("register: empty data throws before RPC", async () => {
    const { soroban, getAccount } = spyCtx();
    await expect(
      buildRegisterTx({ account: ACCOUNT, contractId: CONTRACT, soroban, auditorId: 1, data: new Uint8Array() }),
    ).rejects.toThrow(/data .*non-empty/);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("deposit: non-positive amount throws before RPC", async () => {
    const { soroban, getAccount } = spyCtx();
    await expect(
      buildDepositTx({ account: ACCOUNT, contractId: CONTRACT, soroban, amountStroops: 0n }),
    ).rejects.toThrow(/amountStroops must be a positive/);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("transfer: invalid recipient throws before RPC", async () => {
    const { soroban, getAccount } = spyCtx();
    await expect(
      buildTransferTx({ account: ACCOUNT, contractId: CONTRACT, soroban, recipient: "nope", data: DATA }),
    ).rejects.toThrow(/Invalid recipient/);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("withdraw: invalid destination throws before RPC", async () => {
    const { soroban, getAccount } = spyCtx();
    await expect(
      buildWithdrawTx({ account: ACCOUNT, contractId: CONTRACT, soroban, destination: "nope", amountStroops: 1n, data: DATA }),
    ).rejects.toThrow(/Invalid destination/);
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("withdraw: negative amount throws before RPC", async () => {
    const { soroban, simulate } = spyCtx();
    await expect(
      buildWithdrawTx({ account: ACCOUNT, contractId: CONTRACT, soroban, amountStroops: -1n, data: DATA }),
    ).rejects.toThrow(/amountStroops must be a positive/);
    expect(simulate).not.toHaveBeenCalled();
  });
});

describe("confidential builders — end-to-end with a source-account auth entry", () => {
  it("merge succeeds when the simulation records a source-account auth entry", async () => {
    // sourceAccountAuthEntry is the credential kind buildInvocation accepts.
    const { sourceAccountAuthEntry } = await import("./fixtures.js");
    const soroban = makeCtx({
      simulation: mockSimulationSuccess({ auth: [sourceAccountAuthEntry()] }),
    });
    const built = await buildMergeTx(base(soroban));
    expect(built.confidentialOp).toBe("merge");
    expect(built.thresholdLevel).toBe("medium");
  });
});
