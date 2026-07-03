import {
  BASE_FEE,
  Contract,
  SorobanDataBuilder,
  TransactionBuilder,
  humanizeEvents,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc"; // same import style as submit.ts

/**
 * Network context passed explicitly — this helper does not depend on Z1's
 * per-account network resolution having landed. Callers (API/web propose flow)
 * construct this from `account.network` once Z1 lands; tests construct it from
 * mocks. Deliberately never imports `network.ts`/`rpc.ts` defaults, so nobody
 * "helpfully" wires the mainnet `getRpcServer()` default into confidential
 * builders.
 */
export interface SorobanContext {
  /** Real or mocked RPC server. */
  rpcServer: rpc.Server;
  /** e.g. `Networks.TESTNET` for confidential accounts. */
  networkPassphrase: string;
}

export interface BuildInvocationInput {
  /** Multisig G-address. ALWAYS the transaction source (see SOURCE-ACCOUNT note below). */
  source: string;
  /** C-address of the target contract. */
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  /** Envelope timeout in seconds. Default {@link SOROBAN_TX_TIMEOUT_SECS} (300). */
  timeoutSec?: number;
  /** Per-op inclusion fee in stroops. Default `BASE_FEE` (matches repo builders). */
  inclusionFee?: string;
  /** Safety margin (percent) added to the simulation's `minResourceFee`. Default {@link RESOURCE_FEE_MARGIN_PCT} (15). */
  resourceFeeMarginPct?: number;
}

export interface BuiltInvocation {
  /** ASSEMBLED unsigned envelope (footprint + padded resources included), base64. */
  xdr: string;
  /** The successful simulation, surfaced for cost display / debugging upstream. */
  simulation: Api.SimulateTransactionSuccessResponse;
}

/**
 * Generous timebounds so co-signers have time — mirrors the pipeline's
 * extended-timeout pattern (`builders/config.ts` `timeoutSecs = 300` default).
 *
 * NOTE: for Soroban the binding constraint on a long-lived proposal is the
 * simulated footprint going stale, not the timebounds — the pipeline's
 * "Rebuild & re-propose" path (spec §6.8) covers that; a larger timeout would
 * not help a stale footprint.
 */
export const SOROBAN_TX_TIMEOUT_SECS = 300;

/**
 * Padding over the simulation's `minResourceFee`. The refundable portion of an
 * unused resource fee is refunded on-chain, so over-provisioning is cheap
 * insurance against ledger-state drift between simulate-at-propose and
 * submit-at-threshold (which can be minutes or hours later).
 */
export const RESOURCE_FEE_MARGIN_PCT = 15;

/**
 * Thrown when `simulateTransaction` reports an error. Carries the raw simulation
 * error plus human-readable diagnostics decoded from the simulation's diagnostic
 * events, so the pipeline's `lastError` capture (spec §6.8) gets a useful message
 * for free.
 */
export class SorobanSimulationError extends Error {
  readonly simulationError: string;
  readonly diagnostics: string[];

  constructor(method: string, simulationError: string, diagnostics: string[]) {
    const detail =
      diagnostics.length > 0 ? ` [diagnostics: ${diagnostics.join("; ")}]` : "";
    super(`simulation for ${method} failed: ${simulationError}${detail}`);
    this.name = "SorobanSimulationError";
    this.simulationError = simulationError;
    this.diagnostics = diagnostics;
  }
}

/**
 * Thrown when the simulation reports that archived ledger state must be restored
 * before the invocation can be submitted. Auto-restore is out of scope here; the
 * message names which op to re-run after a manual `restoreFootprint`.
 */
export class SorobanRestoreRequiredError extends Error {
  constructor(method: string) {
    super(
      `simulation for ${method} requires restoring archived ledger entries ` +
        `before submission; run a restoreFootprint transaction, then re-propose ${method}`,
    );
    this.name = "SorobanRestoreRequiredError";
  }
}

/**
 * Decode a simulation's diagnostic events into human-readable strings. Decoding
 * must NEVER mask the original simulation error, so any failure falls back to
 * the raw base64 XDR of the individual event.
 */
function decodeDiagnostics(events: xdr.DiagnosticEvent[]): string[] {
  if (events.length === 0) return [];
  try {
    return humanizeEvents(events).map((e) => JSON.stringify(e));
  } catch {
    return events.map((e) => {
      try {
        return e.toXDR("base64");
      } catch {
        return "<undecodable diagnostic event>";
      }
    });
  }
}

/**
 * Simulate + assemble an UNSIGNED Soroban invocation for a multisig source
 * account, returning the assembled envelope XDR plus the simulation.
 *
 * Steps (each verified against `@stellar/stellar-sdk` 15.1.0):
 *   1. Fetch the source account's sequence.
 *   2. Build the raw single-op tx with timebounds set PRE-simulation.
 *   3. Simulate.
 *   4. On simulation error → {@link SorobanSimulationError} (with decoded
 *      diagnostics); on restore-required → {@link SorobanRestoreRequiredError}.
 *   5. Assert every recorded auth entry uses source-account credentials.
 *   6. Assemble and pad the resource fee by `resourceFeeMarginPct`.
 *   7. Return the assembled unsigned envelope XDR + simulation.
 */
export async function buildInvocation(
  input: BuildInvocationInput & SorobanContext,
): Promise<BuiltInvocation> {
  const {
    source,
    contractId,
    method,
    args,
    timeoutSec = SOROBAN_TX_TIMEOUT_SECS,
    inclusionFee = BASE_FEE,
    resourceFeeMarginPct = RESOURCE_FEE_MARGIN_PCT,
    rpcServer,
    networkPassphrase,
  } = input;

  // 1. Fetch sequence (same as PaymentBuilder).
  const account = await rpcServer.getAccount(source);

  // 2. Build the raw tx — single InvokeHostFunction op. Timebounds are set here,
  //    PRE-simulation: `assembleTransaction` clones them and `TransactionBuilder`
  //    throws if `setTimeout` is called when timebounds already exist, so the
  //    timeout is set once and never touched again.
  //
  //    SOURCE-ACCOUNT CREDENTIALS (spec §2): the multisig G-account is the
  //    transaction source. Soroban's `require_auth` against a classic account,
  //    when that account is the tx source, is satisfied by the transaction
  //    envelope signatures under the account's set_options signers and MEDIUM
  //    threshold — i.e. Cluster's existing collect-signatures pipeline works
  //    unchanged. No SorobanAuthorizationEntry is ever signed out-of-band
  //    (`authorizeEntry` is deliberately unused).
  const raw = new TransactionBuilder(account, {
    fee: inclusionFee,
    networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(timeoutSec)
    .build();

  // 3. Simulate (default auth mode; recording is fine — auth is asserted below).
  const sim = await rpcServer.simulateTransaction(raw);

  // 4. Error surface with decoded diagnostics.
  if (rpc.Api.isSimulationError(sim)) {
    throw new SorobanSimulationError(
      method,
      sim.error,
      decodeDiagnostics(sim.events),
    );
  }
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new SorobanRestoreRequiredError(method);
  }

  const success = sim as Api.SimulateTransactionSuccessResponse;

  // 5. Assert source-account credentials (defensive, spec §2/§4-2). Every
  //    recorded auth entry must be a source-account credential; an
  //    address-credential entry means the invocation requires auth from an
  //    address that is NOT the tx source (e.g. a wrong `from` arg) and would be
  //    a doomed proposal — fail at build time instead. Empty auth passes.
  const auths = success.result?.auth ?? [];
  const allSourceAccount = auths.every(
    (entry) =>
      entry.credentials().switch() ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount(),
  );
  if (!allSourceAccount) {
    throw new Error(
      `simulation for ${method} recorded address-credential auth entries; ` +
        `confidential ops must authorize solely via source-account credentials ` +
        `(multisig envelope signatures)`,
    );
  }

  // 6. Assemble + resource-fee safety margin. `assembleTransaction` preserves the
  //    raw tx's timebounds and returns a TransactionBuilder (caller must build).
  //    `build()` sets `tx.fee = inclusionFee × opCount + sorobanData.resourceFee()`
  //    automatically, so padding the resource fee inside sorobanData is
  //    sufficient — no manual envelope-fee arithmetic. BigInt throughout: fees
  //    near the BN254 verifier limits overflow Number.
  const builder = rpc.assembleTransaction(raw, success);
  const padded =
    (BigInt(success.minResourceFee) * BigInt(100 + resourceFeeMarginPct)) / 100n;
  builder.setSorobanData(
    new SorobanDataBuilder(success.transactionData.build())
      .setResourceFee(padded.toString())
      .build(),
  );
  const assembled = builder.build();

  // 7. Return the assembled unsigned envelope + simulation.
  return { xdr: assembled.toXDR(), simulation: success };
}
