import {
  Asset,
  BASE_FEE,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getRpcServer } from "@cluster/stellar";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import type { BuiltTransaction } from "@cluster/shared";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;

export type TrustlineDraft = {
  /** The multisig account's Stellar public key (transaction source). */
  source: string;
  assetCode: string;
  assetIssuer: string;
};

/**
 * Build an unsigned change_trust envelope adding a trustline for an issued
 * asset. change_trust is a MEDIUM-threshold operation on Stellar; the pipeline
 * resolves the numeric requirement from account.thresholds.medium. 24h
 * timeout, matching the other pipeline builders.
 */
export async function buildTrustlineXdr(
  draft: TrustlineDraft,
): Promise<BuiltTransaction> {
  if (!RPC_URL) {
    throw new Error(
      "NEXT_PUBLIC_STELLAR_RPC_URL is not configured; cannot reach Stellar RPC.",
    );
  }
  const server = getRpcServer(RPC_URL);
  const account = await server.getAccount(draft.source);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(draft.assetCode, draft.assetIssuer),
      }),
    )
    .setTimeout(24 * 60 * 60)
    .build();

  return { xdr: tx.toXDR(), type: "trustline", thresholdLevel: "medium" };
}
