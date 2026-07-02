import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@cluster/stellar";
import { getWalletKit } from "@/lib/auth/wallet-kit";

/**
 * Sign a transaction envelope with the connected wallet and extract the
 * signer's raw signature. The wallet returns a fully signed envelope, but the
 * pipeline stores each signer's base64 raw ed25519 signature separately
 * (see `CollectedSignature.signatureXdr` — the API recombines them with
 * `combineSignatures` at submit time), so the decorated signature belonging
 * to `signerPublicKey` is pulled back out of the envelope here.
 */
export async function signWithWallet(
  xdr: string,
  signerPublicKey: string,
): Promise<string> {
  const kit = await getWalletKit();
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    address: signerPublicKey,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const tx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const hint = Keypair.fromPublicKey(signerPublicKey).signatureHint();
  const decorated = tx.signatures.find((sig) => sig.hint().equals(hint));
  if (!decorated) {
    throw new Error(
      "The wallet did not return a signature for the connected account.",
    );
  }
  return decorated.signature().toString("base64");
}
