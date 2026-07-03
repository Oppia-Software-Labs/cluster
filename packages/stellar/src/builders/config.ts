import {
  Account,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { BuiltTransaction } from "@cluster/shared";
import { getNetworkPassphrase } from "../network.js";
import {
  addSignerOp,
  setThresholdsOp,
  type Thresholds,
} from "../config-helpers.js";

/** A signer to add to an account, with its voting weight. */
export interface AccountMemberInput {
  publicKey: string;
  weight: number;
}

export interface CreateAccountTxInput {
  /** Funder + transaction source. Pays the base fee and the new account's reserve. */
  creatorPublicKey: string;
  /** Current sequence number of the creator account (fetched from the network). */
  creatorSequence: string;
  /** Public key of the freshly generated account being turned into a multisig. */
  newAccountPublicKey: string;
  /** Initial signer set (typically includes the creator). */
  members: AccountMemberInput[];
  /** low/medium/high thresholds the new account will enforce. */
  thresholds: Thresholds;
  /** Starting XLM balance to fund the new account with (as a decimal string). */
  startingBalance: string;
  /** Per-operation fee in stroops. Defaults to BASE_FEE; SDK multiplies by op count. */
  fee?: string;
  /** Transaction timeout in seconds. Defaults to 300. */
  timeoutSecs?: number;
  /**
   * Network passphrase to build against. Defaults to the active network's
   * (STELLAR_NETWORK env). Browser callers must pass it explicitly — env vars
   * are not inlined inside this package's bundle.
   */
  networkPassphrase?: string;
}

/**
 * Guard against permanently locking the account. After the master key is
 * disabled, the account can only ever act if the combined weight of its signers
 * can satisfy each threshold level. If any threshold exceeds the total signer
 * weight, the account is unusable forever (mirrors the DANGER contract on
 * `config-helpers.disableMasterKeyOp`). Throws when unsatisfiable.
 */
export function assertThresholdsSatisfiable(
  members: AccountMemberInput[],
  thresholds: Thresholds,
): void {
  if (members.length === 0) {
    throw new Error("An account must have at least one signer.");
  }
  for (const m of members) {
    if (!Number.isInteger(m.weight) || m.weight <= 0) {
      throw new Error(`Signer ${m.publicKey} must have a positive integer weight.`);
    }
  }
  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
  for (const [level, required] of Object.entries(thresholds)) {
    if (required > totalWeight) {
      throw new Error(
        `Unsatisfiable ${level} threshold: requires ${required} but total signer ` +
          `weight is only ${totalWeight}. The account would be permanently locked.`,
      );
    }
  }
}

/**
 * Build the unsigned XDR that creates and configures a native-multisig account
 * in a single atomic transaction. Source = creator (funds + pays fee):
 *   1. createAccount  — fund the new account (tx source = creator).
 *   2. setOptions × N — add each member as a signer (op source = new account).
 *   3. setOptions     — set low/medium/high thresholds (op source = new account).
 *   4. setOptions     — disable the new account's master key (op source = new account).
 *
 * Requires TWO signatures before submission: the creator (via wallet) and the
 * new account's master key (held in-app only long enough to sign, then discarded).
 *
 * ON MAINNET THIS IS REAL FUNDS. `assertThresholdsSatisfiable` runs first so
 * a self-locking configuration can never be built.
 */
export function buildCreateAccountTx(input: CreateAccountTxInput): string {
  const {
    creatorPublicKey,
    creatorSequence,
    newAccountPublicKey,
    members,
    thresholds,
    startingBalance,
    fee = BASE_FEE,
    timeoutSecs = 300,
    networkPassphrase = getNetworkPassphrase(),
  } = input;

  assertThresholdsSatisfiable(members, thresholds);

  const source = new Account(creatorPublicKey, creatorSequence);
  const builder = new TransactionBuilder(source, {
    fee,
    networkPassphrase,
  });

  // 1. Creator funds the new account (no op source → defaults to the tx source).
  builder.addOperation(
    Operation.createAccount({
      destination: newAccountPublicKey,
      startingBalance,
    }),
  );

  // 2–4. Configure the NEW account. The tx source is the creator, so each
  // set_options must target the new account via an operation-level `source`.
  // The M1 config-helpers don't accept a source, so these ops are built here.
  for (const m of members) {
    builder.addOperation(
      Operation.setOptions({
        source: newAccountPublicKey,
        signer: { ed25519PublicKey: m.publicKey, weight: m.weight },
      }),
    );
  }
  builder.addOperation(
    Operation.setOptions({
      source: newAccountPublicKey,
      lowThreshold: thresholds.low,
      medThreshold: thresholds.medium,
      highThreshold: thresholds.high,
    }),
  );
  // Disabled LAST so the master key stays valid to authorize the preceding
  // set_options ops within this same transaction. See disableMasterKeyOp.
  builder.addOperation(
    Operation.setOptions({ source: newAccountPublicKey, masterWeight: 0 }),
  );

  return builder.setTimeout(timeoutSecs).build().toXDR();
}

/**
 * Context for a configuration change on an EXISTING multisig account. Here the
 * account itself is the transaction source, so the M1 config-helpers are reused
 * directly (no operation-level source needed).
 */
export interface ConfigTxContext {
  /** The multisig account's public key — the transaction source. */
  accountPublicKey: string;
  /** Current sequence number of the multisig account. */
  sequence: string;
  fee?: string;
  timeoutSecs?: number;
  /** Network passphrase. Defaults to the active network's (STELLAR_NETWORK). */
  networkPassphrase?: string;
}

function buildConfigTx(ctx: ConfigTxContext, op: xdr.Operation): BuiltTransaction {
  const {
    accountPublicKey,
    sequence,
    fee = BASE_FEE,
    timeoutSecs = 300,
    networkPassphrase = getNetworkPassphrase(),
  } = ctx;
  const source = new Account(accountPublicKey, sequence);
  const tx = new TransactionBuilder(source, {
    fee,
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(timeoutSecs)
    .build();
  // set_options is a HIGH-threshold operation; the pipeline resolves the numeric
  // requirement from account.thresholds.high.
  return { xdr: tx.toXDR(), type: "config", thresholdLevel: "high" };
}

/**
 * Config-change builders for the propose→sign→submit pipeline (Member 3).
 * Implemented now as pure builders; wired into the pipeline in a later point.
 */
export function buildAddMemberTx(
  ctx: ConfigTxContext,
  member: AccountMemberInput,
): BuiltTransaction {
  return buildConfigTx(ctx, addSignerOp(member.publicKey, member.weight));
}

/** Removing a member is adding their signer with weight 0. */
export function buildRemoveMemberTx(
  ctx: ConfigTxContext,
  publicKey: string,
): BuiltTransaction {
  return buildConfigTx(ctx, addSignerOp(publicKey, 0));
}

export function buildSetThresholdsTx(
  ctx: ConfigTxContext,
  thresholds: Thresholds,
): BuiltTransaction {
  return buildConfigTx(ctx, setThresholdsOp(thresholds));
}
