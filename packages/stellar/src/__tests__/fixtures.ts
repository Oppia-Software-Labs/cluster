import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
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
