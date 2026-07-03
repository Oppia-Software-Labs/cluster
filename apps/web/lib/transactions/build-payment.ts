import {
  Asset,
  BASE_FEE,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getRpcServer } from "@cluster/stellar";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";
import type { BuiltTransaction } from "@cluster/shared";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;

export type PaymentDraft = {
  /** The multisig account's Stellar public key (transaction source). */
  source: string;
  destination: string;
  /** null issuer ⇒ native XLM. */
  asset: "native" | { code: string; issuer: string };
  amount: string;
  memo?: string;
};

/**
 * Build an unsigned payment transaction envelope (XDR) for the multisig source
 * account. Mirrors @cluster/stellar's PaymentBuilder but passes the browser RPC
 * URL explicitly — the package default reads a server-only env var. The result
 * is proposed to the API, then signed/submitted through the multisig pipeline.
 */
export async function buildPaymentXdr(
  draft: PaymentDraft,
): Promise<BuiltTransaction> {
  if (!RPC_URL) {
    throw new Error(
      "NEXT_PUBLIC_STELLAR_RPC_URL is not configured; cannot reach Stellar RPC.",
    );
  }
  const server = getRpcServer(RPC_URL);
  const account = await server.getAccount(draft.source);

  const asset =
    draft.asset === "native"
      ? Asset.native()
      : new Asset(draft.asset.code, draft.asset.issuer);

  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({ destination: draft.destination, asset, amount: draft.amount }),
  );

  if (draft.memo) {
    builder = builder.addMemo(Memo.text(draft.memo));
  }

  // The envelope must outlive the signature-collection window — other signers
  // may take hours to approve. 24h, matching the config builders.
  const tx = builder.setTimeout(24 * 60 * 60).build();

  return { xdr: tx.toXDR(), type: "payment", thresholdLevel: "medium" };
}
