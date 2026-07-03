import {
  Account,
  Address,
  Asset,
  Keypair,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  BASE_FEE,
  xdr,
} from "@stellar/stellar-sdk";
import type { Api } from "@stellar/stellar-sdk/rpc";
import { MAINNET_NETWORK_PASSPHRASE as NETWORK_PASSPHRASE } from "../network.js";

/** Three throwaway signer keypairs. NEVER funded — for offline tests only. */
export const signerA = Keypair.random();
export const signerB = Keypair.random();
export const signerC = Keypair.random();

/** A source account with an in-memory sequence number (no network load). */
export function makeSourceAccount(): Account {
  return new Account(signerA.publicKey(), "1234567890");
}

/**
 * Build an unsigned payment transaction envelope (base64 XDR) entirely offline.
 * Used as the canonical fixture the aggregation primitives operate on.
 */
export function buildUnsignedXdr(): string {
  const tx = new TransactionBuilder(makeSourceAccount(), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: signerB.publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    )
    .setTimeout(0)
    .build();
  return tx.toXDR();
}

/**
 * Produce a base64-encoded raw signature for `xdr` by `signer`, exactly as a
 * collected AddSignatureDto.signatureXdr would arrive over the wire.
 */
export function signatureFor(xdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  return signer.sign(tx.hash()).toString("base64");
}

// ---------------------------------------------------------------------------
// Soroban simulation fixtures (offline). These build genuine SDK objects — a
// REAL SorobanDataBuilder so `assembleTransaction`'s `.build()` path runs
// unmocked, and `_parsed: true` so the SDK passes the response through untouched.
// ---------------------------------------------------------------------------

/** A source-account credential auth entry (the only kind that must pass). */
export function sourceAccountAuthEntry(): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: dummyRootInvocation(),
  });
}

/** An address-credential auth entry (must be rejected by buildInvocation). */
export function addressAuthEntry(
  address = Keypair.random().publicKey(),
): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: xdr.Int64.fromString("0"),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: dummyRootInvocation(),
  });
}

function dummyRootInvocation(): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(
            "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
          ).toScAddress(),
          functionName: "foo",
          args: [],
        }),
      ),
    subInvocations: [],
  });
}

export interface SimulationSuccessOverrides {
  minResourceFee?: string;
  auth?: xdr.SorobanAuthorizationEntry[];
  events?: xdr.DiagnosticEvent[];
}

/** A genuine `SimulateTransactionSuccessResponse` shape. */
export function mockSimulationSuccess(
  overrides: SimulationSuccessOverrides = {},
): Api.SimulateTransactionSuccessResponse {
  const { minResourceFee = "1000000", auth = [], events = [] } = overrides;
  return {
    id: "1",
    latestLedger: 100,
    events,
    _parsed: true,
    // A REAL SorobanDataBuilder carrying the (unpadded) resource fee.
    transactionData: new SorobanDataBuilder().setResourceFee(minResourceFee),
    minResourceFee,
    result: { auth, retval: xdr.ScVal.scvVoid() },
  } as Api.SimulateTransactionSuccessResponse;
}

/** A `SimulateTransactionErrorResponse` shape carrying one diagnostic event. */
export function mockSimulationError(
  error = "HostError: Error(Contract, #123)",
  events: xdr.DiagnosticEvent[] = [makeDiagnosticEvent()],
): Api.SimulateTransactionErrorResponse {
  return {
    id: "1",
    latestLedger: 100,
    events,
    _parsed: true,
    error,
  } as Api.SimulateTransactionErrorResponse;
}

/** A `SimulateTransactionRestoreResponse` shape (restore preamble present). */
export function mockSimulationRestore(): Api.SimulateTransactionRestoreResponse {
  const base = mockSimulationSuccess();
  return {
    ...base,
    result: base.result!,
    restorePreamble: {
      minResourceFee: "500000",
      transactionData: new SorobanDataBuilder().setResourceFee("500000"),
    },
  } as Api.SimulateTransactionRestoreResponse;
}

/** A single well-formed diagnostic event usable by `humanizeEvents`. */
export function makeDiagnosticEvent(): xdr.DiagnosticEvent {
  const event = new xdr.ContractEvent({
    ext: new xdr.ExtensionPoint(0),
    contractId: null,
    type: xdr.ContractEventType.diagnostic(),
    body: new xdr.ContractEventBody(
      0,
      new xdr.ContractEventV0({
        topics: [xdr.ScVal.scvSymbol("error")],
        data: xdr.ScVal.scvString("boom"),
      }),
    ),
  });
  return new xdr.DiagnosticEvent({ inSuccessfulContractCall: false, event });
}

/**
 * A plain mock RPC server (payment.test.ts style) satisfying the subset of
 * `rpc.Server` that `buildInvocation` calls. Injected via the explicit
 * `SorobanContext` — no module spying, no network.
 */
export function mockRpcServer(opts: {
  account?: Account;
  simulation:
    | Api.SimulateTransactionResponse
    | (() => Api.SimulateTransactionResponse);
  getAccount?: (source: string) => Promise<Account>;
}): {
  getAccount: (source: string) => Promise<Account>;
  simulateTransaction: (...args: unknown[]) => Promise<unknown>;
} {
  const account = opts.account ?? makeSourceAccount();
  const getAccount =
    opts.getAccount ?? (async (_source: string) => account);
  const simulateTransaction = async () =>
    typeof opts.simulation === "function"
      ? opts.simulation()
      : opts.simulation;
  return { getAccount, simulateTransaction };
}
