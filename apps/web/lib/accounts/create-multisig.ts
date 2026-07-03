import { Keypair, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import {
  buildCreateAccountTx,
  getRpcServer,
  submitSignedXdr,
  type AccountMemberInput,
} from "@cluster/stellar";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import type { AccountThresholds } from "@cluster/shared";
import { getWalletKit } from "@/lib/auth/wallet-kit";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;

export interface CreateMultisigParams {
  /** The connected creator wallet — funds the new account and signs first. */
  creatorPublicKey: string;
  members: AccountMemberInput[];
  thresholds: AccountThresholds;
  /** Starting XLM balance for the new account (decimal string). */
  startingBalance: string;
}

export interface CreateMultisigResult {
  /** Public key of the new, now member-controlled, Stellar account. */
  stellarAccountId: string;
  /** Submission hash of the bootstrap transaction. */
  hash: string;
}

/**
 * Create and configure a native-multisig account on the configured network
 * (NEXT_PUBLIC_STELLAR_NETWORK), then return the details to persist via the
 * API.
 *
 * The new account's secret key is generated here and never leaves this function:
 * it signs the bootstrap transaction in memory and is discarded when the call
 * returns. The creator signs through their connected wallet.
 */
export async function createMultisigOnChain(
  params: CreateMultisigParams,
): Promise<CreateMultisigResult> {
  if (!RPC_URL) {
    throw new Error(
      "NEXT_PUBLIC_STELLAR_RPC_URL is not configured; cannot reach Stellar RPC.",
    );
  }
  const server = getRpcServer(RPC_URL);

  // Brand-new account. Scoped to this function — the secret is never persisted,
  // logged, or returned.
  const newAccount = Keypair.random();

  // The funder's current sequence drives the bootstrap transaction.
  const creatorAccount = await server.getAccount(params.creatorPublicKey);

  const unsignedXdr = buildCreateAccountTx({
    creatorPublicKey: params.creatorPublicKey,
    creatorSequence: creatorAccount.sequenceNumber(),
    newAccountPublicKey: newAccount.publicKey(),
    members: params.members,
    thresholds: params.thresholds,
    startingBalance: params.startingBalance,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // 1. Creator authorizes the funding (createAccount) via their wallet.
  const kit = await getWalletKit();
  const { signedTxXdr } = await kit.signTransaction(unsignedXdr, {
    address: params.creatorPublicKey,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // 2. Co-sign with the new account's master key, which authorizes the
  //    set_options ops before it is disabled by the final op.
  const tx = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE,
  ) as Transaction;
  tx.sign(newAccount);

  // 3. Submit the fully-signed bootstrap transaction.
  const result = await submitSignedXdr(tx.toXDR(), {
    server,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (result.status !== Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      `Account creation failed on-chain (status: ${result.status}, tx: ${result.hash}).`,
    );
  }

  return { stellarAccountId: newAccount.publicKey(), hash: result.hash };
}

/**
 * Minimum XLM the new account must hold: the base reserve (1 XLM) plus 0.5 XLM
 * per added signer subentry, with a small buffer for the transaction fee.
 */
export function suggestedStartingBalance(memberCount: number): string {
  return (1 + 0.5 * memberCount + 0.5).toFixed(1);
}
