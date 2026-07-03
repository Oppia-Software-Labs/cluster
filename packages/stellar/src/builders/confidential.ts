import {
  Address,
  StrKey,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import type { Api } from "@stellar/stellar-sdk/rpc";
import type { BuiltTransaction } from "@cluster/shared";
import {
  buildInvocation,
  type SorobanContext,
} from "../soroban.js";

/**
 * The five confidential-token operation builders — thin wrappers over
 * {@link buildInvocation} that map typed args to `xdr.ScVal[]`, delegate the
 * simulate+assemble+fee-margin plumbing, and stamp the {@link BuiltTransaction}
 * envelope with `type: "confidential"`, `thresholdLevel: "medium"`, and the
 * specific `confidentialOp`.
 *
 * OPAQUE-BYTES COORDINATION RULE (load-bearing — spec §2, plan §0.2 delta 2):
 * the `data: Uint8Array` argument of register/transfer/withdraw is the
 * ALREADY-XDR-ENCODED `{ payload, proof }` envelope produced by `@cluster/zk`'s
 * payload codec (Z2). These builders wrap it in `scvBytes` byte-for-byte and
 * NEVER construct, parse, decode, or validate its contents — the envelope's
 * byte layout has exactly one owner (Z2). A cross-package seam fixture pins the
 * pass-through byte-for-byte.
 *
 * SOURCE-ACCOUNT CREDENTIALS (spec §2): the multisig `account` is always the
 * transaction source AND the `require_auth` address. Soroban's `require_auth`
 * against a classic account, when that account is the tx source, is satisfied
 * by the envelope signatures the existing collect-signatures pipeline already
 * gathers at the MEDIUM threshold — hence `thresholdLevel: "medium"`.
 */

/**
 * Confidential-token operation. Locally defined to match `@cluster/shared`'s
 * `confidentialOpSchema` union exactly (a values-identical mirror), so this
 * module carries no runtime dependency on the shared enum while
 * `builtTransactionSchema` still validates the envelope.
 */
export type ConfidentialOp =
  | "register"
  | "deposit"
  | "merge"
  | "transfer"
  | "withdraw";

/** Common to all five builders. */
export interface ConfidentialTxBase {
  /** Multisig G-address — tx source AND the `require_auth` address. */
  account: string;
  /** ConfidentialToken C-address. */
  contractId: string;
  soroban: SorobanContext;
  /** Envelope timeout in seconds. Defaults to the soroban helper's constant. */
  timeoutSec?: number;
}

export type ConfidentialBuilt = BuiltTransaction & {
  confidentialOp: ConfidentialOp;
  /** Surfaced from {@link buildInvocation} for cost display in the propose UI. */
  simulation: Api.SimulateTransactionSuccessResponse;
};

// --- private ScVal encoders (mirror the verified demo encoding) -------------

/** G/C-address → ScVal. `Address` throws on an invalid strkey. */
const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
const u32 = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n);
const i128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" });
/** Opaque codec envelope → ScVal bytes, byte-for-byte, never introspected. */
const bytes = (b: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(b));

// --- validation (fail fast, BEFORE any RPC / buildInvocation call) ----------

function assertAccountAndContract(account: string, contractId: string): void {
  if (!StrKey.isValidEd25519PublicKey(account)) {
    throw new Error(`Invalid account G-address: ${account}`);
  }
  if (!StrKey.isValidContract(contractId)) {
    throw new Error(`Invalid contract C-address: ${contractId}`);
  }
}

function assertAddress(value: string, label: string): void {
  // `Address` accepts both G- and C-addresses and throws otherwise.
  try {
    new Address(value);
  } catch {
    throw new Error(`Invalid ${label} address: ${value}`);
  }
}

function assertAmount(amountStroops: bigint): void {
  if (amountStroops <= 0n) {
    throw new Error(
      `amountStroops must be a positive integer (got ${amountStroops})`,
    );
  }
}

function assertData(data: Uint8Array): void {
  if (data.length === 0) {
    throw new Error("data (codec envelope) must be non-empty");
  }
}

function assertAuditorId(auditorId: number): void {
  if (
    !Number.isInteger(auditorId) ||
    auditorId < 0 ||
    auditorId > 0xffffffff
  ) {
    throw new Error(`auditorId must be a u32 (got ${auditorId})`);
  }
}

/** Stamp a {@link BuiltInvocation} into the frozen confidential envelope. */
function stamp(
  built: { xdr: string; simulation: Api.SimulateTransactionSuccessResponse },
  confidentialOp: ConfidentialOp,
): ConfidentialBuilt {
  return {
    xdr: built.xdr,
    type: "confidential",
    thresholdLevel: "medium",
    confidentialOp,
    simulation: built.simulation,
  };
}

// --- the five builders ------------------------------------------------------

/**
 * register(account, auditor_id, data) — `account.require_auth()`.
 *
 * NOTE (plan §0.2 delta 2): spendingPubKey/viewingPubKey/proof are NOT separate
 * args — they live INSIDE the opaque `data` envelope owned by `@cluster/zk`.
 */
export async function buildRegisterTx(
  input: ConfidentialTxBase & { auditorId: number; data: Uint8Array },
): Promise<ConfidentialBuilt> {
  const { account, contractId, soroban, timeoutSec, auditorId, data } = input;
  assertAccountAndContract(account, contractId);
  assertAuditorId(auditorId);
  assertData(data);

  const built = await buildInvocation({
    source: account,
    contractId,
    method: "register",
    args: [addr(account), u32(auditorId), bytes(data)],
    timeoutSec,
    ...soroban,
  });
  return stamp(built, "register");
}

/**
 * deposit(from, to, amount) — `from.require_auth()`, NO proof (public amount).
 *
 * In Cluster's flow `from === to === account`: the public XLM leaves the
 * multisig's classic balance and the same multisig's confidential account is
 * credited. This is the public→private boundary (spec §6.2).
 */
export async function buildDepositTx(
  input: ConfidentialTxBase & { amountStroops: bigint },
): Promise<ConfidentialBuilt> {
  const { account, contractId, soroban, timeoutSec, amountStroops } = input;
  assertAccountAndContract(account, contractId);
  assertAmount(amountStroops);

  const built = await buildInvocation({
    source: account,
    contractId,
    method: "deposit",
    // from === to === account.
    args: [addr(account), addr(account), i128(amountStroops)],
    timeoutSec,
    ...soroban,
  });
  return stamp(built, "deposit");
}

/**
 * merge(account) — `account.require_auth()`.
 *
 * REGRESSION PIN (plan §0.2 delta 1): `merge` takes NO proof/data argument —
 * exactly ONE arg. Verified against the OZ `stellar-contracts` trait
 * (`packages/tokens/src/confidential/mod.rs`), whose doc comment notes
 * correctness "follows from the homomorphic property of Pedersen commitments".
 * This differs from spec §6.3's "propose merge with its proof" wording; if the
 * pinned contract later adds an arg, extending this builder is additive.
 */
export async function buildMergeTx(
  input: ConfidentialTxBase,
): Promise<ConfidentialBuilt> {
  const { account, contractId, soroban, timeoutSec } = input;
  assertAccountAndContract(account, contractId);

  const built = await buildInvocation({
    source: account,
    contractId,
    method: "merge",
    args: [addr(account)],
    timeoutSec,
    ...soroban,
  });
  return stamp(built, "merge");
}

/**
 * confidential_transfer(from, to, data) — `from.require_auth()`; proof inside
 * `data`. The recipient must be registered on the token (enforced on-chain).
 */
export async function buildTransferTx(
  input: ConfidentialTxBase & { recipient: string; data: Uint8Array },
): Promise<ConfidentialBuilt> {
  const { account, contractId, soroban, timeoutSec, recipient, data } = input;
  assertAccountAndContract(account, contractId);
  assertAddress(recipient, "recipient");
  assertData(data);

  const built = await buildInvocation({
    source: account,
    contractId,
    method: "confidential_transfer",
    args: [addr(account), addr(recipient), bytes(data)],
    timeoutSec,
    ...soroban,
  });
  return stamp(built, "transfer");
}

/**
 * withdraw(from, to, amount, data) — `from.require_auth()`; proof inside
 * `data`; public amount (spec §6.5). `to` receives the underlying tokens and
 * defaults to the multisig account itself.
 */
export async function buildWithdrawTx(
  input: ConfidentialTxBase & {
    destination?: string;
    amountStroops: bigint;
    data: Uint8Array;
  },
): Promise<ConfidentialBuilt> {
  const { account, contractId, soroban, timeoutSec, destination, amountStroops, data } =
    input;
  assertAccountAndContract(account, contractId);
  if (destination !== undefined) {
    assertAddress(destination, "destination");
  }
  assertAmount(amountStroops);
  assertData(data);

  const to = destination ?? account;
  const built = await buildInvocation({
    source: account,
    contractId,
    method: "withdraw",
    args: [addr(account), addr(to), i128(amountStroops), bytes(data)],
    timeoutSec,
    ...soroban,
  });
  return stamp(built, "withdraw");
}
