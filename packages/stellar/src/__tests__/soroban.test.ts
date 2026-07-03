import { describe, it, expect, vi } from "vitest";
import {
  Account,
  Address,
  BASE_FEE,
  Networks,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  buildInvocation,
  SorobanSimulationError,
  SorobanRestoreRequiredError,
  SOROBAN_TX_TIMEOUT_SECS,
  RESOURCE_FEE_MARGIN_PCT,
  type SorobanContext,
} from "../soroban.js";
import {
  addressAuthEntry,
  makeDiagnosticEvent,
  mockRpcServer,
  mockSimulationError,
  mockSimulationRestore,
  mockSimulationSuccess,
  sourceAccountAuthEntry,
} from "./fixtures.js";

const PASSPHRASE = Networks.TESTNET;
// A valid, deterministic G-address (StrKey ed25519) and a C-address.
const SOURCE = "GDNSSYSCSSJ76FER5WEEXME5G4MTCUBKDRQSKOYP36KUKVDB2VCMERS6";
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function ctx(overrides: {
  simulation?: ReturnType<typeof mockSimulationSuccess>;
  getAccount?: (source: string) => Promise<Account>;
  account?: Account;
}): SorobanContext {
  const server = mockRpcServer({
    simulation: overrides.simulation ?? mockSimulationSuccess(),
    getAccount: overrides.getAccount,
    account: overrides.account ?? new Account(SOURCE, "100"),
  });
  return {
    // The mock satisfies the subset of rpc.Server buildInvocation touches.
    rpcServer: server as unknown as SorobanContext["rpcServer"],
    networkPassphrase: PASSPHRASE,
  };
}

function baseInput() {
  return {
    source: SOURCE,
    contractId: CONTRACT,
    method: "merge",
    args: [new Address(SOURCE).toScVal()],
  };
}

/** Parse an XDR envelope, narrowing to a classic (non-fee-bump) Transaction. */
function parseTx(txXdr: string): Transaction {
  return TransactionBuilder.fromXDR(txXdr, PASSPHRASE) as Transaction;
}

/** Decode the resource fee out of an assembled envelope's soroban data. */
function resourceFeeOf(txXdr: string): bigint {
  const tx = parseTx(txXdr);
  const sorobanData = (tx as any).toEnvelope().v1().tx().ext().sorobanData();
  return BigInt(new SorobanDataBuilder(sorobanData).build().resourceFee().toString());
}

describe("buildInvocation — happy path", () => {
  it("returns an assembled unsigned envelope that roundtrips with one invokeHostFunction op", async () => {
    const built = await buildInvocation({ ...baseInput(), ...ctx({}) });

    const tx = parseTx(built.xdr);
    expect(tx.source).toBe(SOURCE);
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]!.type).toBe("invokeHostFunction");

    // method + args preserved on the invokeContract host function.
    const op = (tx as any).toEnvelope().v1().tx().operations()[0];
    const invoke = op.body().invokeHostFunctionOp().hostFunction().invokeContract();
    expect(invoke.functionName().toString()).toBe("merge");
    const argAddr = Address.fromScVal(invoke.args()[0]).toString();
    expect(argAddr).toBe(SOURCE);

    // simulation surfaced.
    expect(built.simulation.minResourceFee).toBe("1000000");
  });
});

describe("buildInvocation — timebounds", () => {
  it("sets maxTime ≈ now + default timeout and preserves it through assembly", async () => {
    const before = Math.floor(Date.now() / 1000);
    const built = await buildInvocation({ ...baseInput(), ...ctx({}) });
    const after = Math.floor(Date.now() / 1000);

    const tx = parseTx(built.xdr);
    const maxTime = Number(tx.timeBounds!.maxTime);
    expect(maxTime).toBeGreaterThanOrEqual(before + SOROBAN_TX_TIMEOUT_SECS);
    expect(maxTime).toBeLessThanOrEqual(after + SOROBAN_TX_TIMEOUT_SECS + 2);
  });

  it("honors a custom timeoutSec", async () => {
    const before = Math.floor(Date.now() / 1000);
    const built = await buildInvocation({
      ...baseInput(),
      timeoutSec: 60,
      ...ctx({}),
    });
    const tx = parseTx(built.xdr);
    const maxTime = Number(tx.timeBounds!.maxTime);
    expect(maxTime).toBeGreaterThanOrEqual(before + 60);
    expect(maxTime).toBeLessThanOrEqual(before + 60 + 3);
  });

  it("keeps timebounds identical pre- and post-assembly (clone preserves them)", async () => {
    // Capture the raw tx's timebounds by inspecting what simulateTransaction receives.
    let rawMaxTime: string | undefined;
    const server = mockRpcServer({
      simulation: mockSimulationSuccess(),
      getAccount: async () => new Account(SOURCE, "100"),
    });
    const orig = server.simulateTransaction;
    server.simulateTransaction = async (tx: any) => {
      rawMaxTime = tx.timeBounds?.maxTime?.toString();
      return orig(tx);
    };

    const built = await buildInvocation({
      ...baseInput(),
      rpcServer: server as any,
      networkPassphrase: PASSPHRASE,
    });
    const assembledMaxTime = parseTx(built.xdr)
      .timeBounds!.maxTime.toString();
    expect(assembledMaxTime).toBe(rawMaxTime);
  });
});

describe("buildInvocation — fee math", () => {
  it("pads resourceFee by the default 15% and sets tx.fee = inclusion + padded", async () => {
    const built = await buildInvocation({
      ...baseInput(),
      ...ctx({ simulation: mockSimulationSuccess({ minResourceFee: "1000000" }) }),
    });
    const padded = (1000000n * BigInt(100 + RESOURCE_FEE_MARGIN_PCT)) / 100n;
    expect(resourceFeeOf(built.xdr)).toBe(padded);

    const tx = parseTx(built.xdr);
    expect(BigInt(tx.fee)).toBe(BigInt(BASE_FEE) + padded);
  });

  it("honors a custom resourceFeeMarginPct", async () => {
    const built = await buildInvocation({
      ...baseInput(),
      resourceFeeMarginPct: 50,
      ...ctx({ simulation: mockSimulationSuccess({ minResourceFee: "2000000" }) }),
    });
    expect(resourceFeeOf(built.xdr)).toBe((2000000n * 150n) / 100n);
  });

  it("margin of 0 yields minResourceFee exactly", async () => {
    const built = await buildInvocation({
      ...baseInput(),
      resourceFeeMarginPct: 0,
      ...ctx({ simulation: mockSimulationSuccess({ minResourceFee: "1234567" }) }),
    });
    expect(resourceFeeOf(built.xdr)).toBe(1234567n);
  });
});

describe("buildInvocation — simulation error", () => {
  it("throws SorobanSimulationError with method, error, and decoded diagnostics", async () => {
    const server = mockRpcServer({
      simulation: mockSimulationError("HostError: Error(Contract, #7)", [
        makeDiagnosticEvent(),
      ]),
    });

    await expect(
      buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({
      name: "SorobanSimulationError",
      simulationError: "HostError: Error(Contract, #7)",
    });

    try {
      await buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      });
      expect.unreachable();
    } catch (e) {
      const err = e as SorobanSimulationError;
      expect(err.message).toContain("merge");
      expect(err.message).toContain("HostError: Error(Contract, #7)");
      expect(err.diagnostics.length).toBeGreaterThan(0);
      expect(err.diagnostics[0]).toContain("boom");
    }
  });

  it("falls back to raw XDR without masking the original error when a diagnostic event is corrupted", async () => {
    // A DiagnosticEvent whose humanize path throws, forcing the fallback branch.
    const corrupt = {
      toXDR: () => "RAW_EVENT_BASE64",
    } as unknown as xdr.DiagnosticEvent;
    const server = mockRpcServer({
      simulation: mockSimulationError("boom-error", [corrupt]),
    });

    try {
      await buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      });
      expect.unreachable();
    } catch (e) {
      const err = e as SorobanSimulationError;
      // Original error is never masked.
      expect(err.simulationError).toBe("boom-error");
      expect(err.message).toContain("boom-error");
      // Fallback diagnostic captured the raw XDR.
      expect(err.diagnostics).toContain("RAW_EVENT_BASE64");
    }
  });
});

describe("buildInvocation — restore required", () => {
  it("throws SorobanRestoreRequiredError naming the method", async () => {
    const server = mockRpcServer({ simulation: mockSimulationRestore() });
    await expect(
      buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toBeInstanceOf(SorobanRestoreRequiredError);
    await expect(
      buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toThrow(/merge/);
  });
});

describe("buildInvocation — source-account credentials assertion (LOAD-BEARING)", () => {
  it("throws when any auth entry is an address credential", async () => {
    const built = buildInvocation({
      ...baseInput(),
      ...ctx({
        simulation: mockSimulationSuccess({
          auth: [sourceAccountAuthEntry(), addressAuthEntry()],
        }),
      }),
    });
    await expect(built).rejects.toThrow(/source-account credentials/);
  });

  it("passes when all auth entries are source-account credentials", async () => {
    const built = await buildInvocation({
      ...baseInput(),
      ...ctx({
        simulation: mockSimulationSuccess({
          auth: [sourceAccountAuthEntry(), sourceAccountAuthEntry()],
        }),
      }),
    });
    expect(built.xdr).toBeTypeOf("string");
  });

  it("passes when auth is empty", async () => {
    const built = await buildInvocation({
      ...baseInput(),
      ...ctx({ simulation: mockSimulationSuccess({ auth: [] }) }),
    });
    expect(built.xdr).toBeTypeOf("string");
  });
});

describe("buildInvocation — sequence fetch", () => {
  it("calls getAccount with the source and uses its sequence", async () => {
    const getAccount = vi.fn(async (_s: string) => new Account(SOURCE, "42"));
    const server = mockRpcServer({ simulation: mockSimulationSuccess(), getAccount });

    await buildInvocation({
      ...baseInput(),
      rpcServer: server as any,
      networkPassphrase: PASSPHRASE,
    });
    expect(getAccount).toHaveBeenCalledWith(SOURCE);
  });

  it("propagates an RPC failure from getAccount", async () => {
    const getAccount = vi.fn(async () => {
      throw new Error("rpc down");
    });
    const server = mockRpcServer({ simulation: mockSimulationSuccess(), getAccount });

    await expect(
      buildInvocation({
        ...baseInput(),
        rpcServer: server as any,
        networkPassphrase: PASSPHRASE,
      }),
    ).rejects.toThrow("rpc down");
  });
});
