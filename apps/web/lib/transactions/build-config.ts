import {
  buildAddMemberTx,
  buildRemoveMemberTx,
  buildSetThresholdsTx,
  getRpcServer,
  type AccountMemberInput,
  type ConfigTxContext,
} from "@cluster/stellar";
import type { AccountThresholds, BuiltTransaction } from "@cluster/shared";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;

/**
 * Config transactions live in the propose→sign→submit pipeline, so the
 * envelope must stay valid long enough for the other signers to act. 24h,
 * mirroring the payment builder.
 */
const CONFIG_TX_TIMEOUT_SECS = 24 * 60 * 60;

/**
 * Resolve the multisig account's current sequence from RPC and assemble the
 * builder context. Mirrors build-payment: the browser passes the public RPC
 * URL explicitly because the package default reads a server-only env var.
 */
async function configCtx(accountPublicKey: string): Promise<ConfigTxContext> {
  if (!RPC_URL) {
    throw new Error(
      "NEXT_PUBLIC_STELLAR_RPC_URL is not configured; cannot reach Stellar RPC.",
    );
  }
  const server = getRpcServer(RPC_URL);
  const account = await server.getAccount(accountPublicKey);
  return {
    accountPublicKey,
    sequence: account.sequenceNumber(),
    timeoutSecs: CONFIG_TX_TIMEOUT_SECS,
    networkPassphrase: NETWORK_PASSPHRASE,
  };
}

/** Unsigned add-signer (set_options) envelope for the pipeline. */
export async function buildAddMemberXdr(
  accountPublicKey: string,
  member: AccountMemberInput,
): Promise<BuiltTransaction> {
  return buildAddMemberTx(await configCtx(accountPublicKey), member);
}

/** Unsigned remove-signer (weight 0) envelope for the pipeline. */
export async function buildRemoveMemberXdr(
  accountPublicKey: string,
  memberPublicKey: string,
): Promise<BuiltTransaction> {
  return buildRemoveMemberTx(await configCtx(accountPublicKey), memberPublicKey);
}

/** Unsigned set-thresholds envelope for the pipeline. */
export async function buildSetThresholdsXdr(
  accountPublicKey: string,
  thresholds: AccountThresholds,
): Promise<BuiltTransaction> {
  return buildSetThresholdsTx(await configCtx(accountPublicKey), thresholds);
}
