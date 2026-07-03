/**
 * Propose→prove→build seam for confidential-token operations.
 *
 * Each proof-carrying op follows the same pipeline:
 *
 *   1. Build the Noir witness with `@cluster/zk` (`witness/*` builders).
 *   2. Prove in the browser via vendored bb.js UltraHonk (keccak transcript)
 *      — {@link ensureBrowserProver} must run first.
 *   3. Encode the opaque `{ payload, proof }` envelope with `@cluster/zk`'s
 *      payload codec (the envelope's byte layout has exactly one owner).
 *   4. Hand the XDR bytes to `@cluster/stellar`'s confidential builders for
 *      Soroban simulate+assemble into a multisig-ready envelope.
 *
 * Deposit and merge skip proving (public or homomorphic-only on-chain). Transfer
 * additionally mints a signer-decryptable {@link ConfidentialPayloadV1} for the
 * multisig differentiator (encrypted opening sealed to the account's `kStore`).
 */

import {
  addressToField,
  deriveKeys,
  deriveAccountKeys,
  buildRegisterWitness,
  buildTransferWitness,
  buildWithdrawWitness,
  encodeRegisterData,
  encodeTransferData,
  encodeWithdrawData,
  encryptOpening,
  bytesToHex,
  proverFromArtifact,
  type NoirInputs,
  type Opening,
} from "@cluster/zk";
import {
  buildRegisterTx,
  buildDepositTx,
  buildMergeTx,
  buildTransferTx,
  buildWithdrawTx,
  type ConfidentialBuilt,
} from "@cluster/stellar";

import { ensureBrowserProver } from "@/lib/bb-loader";
import registerCircuit from "@/lib/zk-artifacts/register.json";
import transferCircuit from "@/lib/zk-artifacts/transfer.json";
import withdrawCircuit from "@/lib/zk-artifacts/withdraw.json";

import {
  CONFIDENTIAL_TOKEN_ID,
  getConfidentialChainClient,
  getSorobanContext,
} from "./chain";

/** Signer-decryptable transfer payload (version 1) for the multisig pipeline. */
export type ConfidentialPayloadV1 = {
  v: 1;
  cipherHex: string;
  recipient: string;
};

/** Wrap an XDR-encoded ScVal in a plain Uint8Array for the stellar builders. */
function scValToBytes(xdr: { toXDR(): Uint8Array }): Uint8Array {
  return new Uint8Array(xdr.toXDR());
}

/** Prove `witness.inputs` with `circuit`, encode the on-chain data envelope. */
async function proveAndEncode<TWitness>(
  circuit: unknown,
  witness: TWitness & { inputs: NoirInputs },
  encode: (w: TWitness, proof: Uint8Array) => { toXDR(): Uint8Array },
): Promise<Uint8Array> {
  ensureBrowserProver();
  const prover = proverFromArtifact(circuit as never);
  try {
    const { proof } = await prover.prove(witness.inputs);
    return scValToBytes(encode(witness, proof));
  } finally {
    await prover.destroy();
  }
}

/** Register this multisig on the confidential token (proof-carrying). */
export async function proposeRegisterTx(args: {
  account: string;
  sk: bigint;
  auditorId: number;
}): Promise<ConfidentialBuilt> {
  const { account, sk, auditorId } = args;
  const keys = deriveKeys(sk, addressToField(CONFIDENTIAL_TOKEN_ID));
  const witness = buildRegisterWitness(keys);
  const data = await proveAndEncode(
    registerCircuit,
    witness,
    encodeRegisterData,
  );

  return buildRegisterTx({
    account,
    contractId: CONFIDENTIAL_TOKEN_ID,
    soroban: getSorobanContext(),
    auditorId,
    data,
  });
}

/** Public deposit from the multisig's classic balance (no proof). */
export async function proposeDepositTx(args: {
  account: string;
  amountStroops: bigint;
}): Promise<ConfidentialBuilt> {
  const { account, amountStroops } = args;
  return buildDepositTx({
    account,
    contractId: CONFIDENTIAL_TOKEN_ID,
    soroban: getSorobanContext(),
    amountStroops,
  });
}

/** Merge spendable + receiving balances (no proof). */
export async function proposeMergeTx(args: {
  account: string;
}): Promise<ConfidentialBuilt> {
  const { account } = args;
  return buildMergeTx({
    account,
    contractId: CONFIDENTIAL_TOKEN_ID,
    soroban: getSorobanContext(),
  });
}

/**
 * Confidential transfer to a registered recipient. Returns the built tx plus a
 * base64 {@link ConfidentialPayloadV1} the signer can decrypt offline.
 */
export async function proposeTransferTx(args: {
  account: string;
  sk: bigint;
  spendable: Opening;
  recipient: string;
  amountStroops: bigint;
  auditorId: number;
}): Promise<ConfidentialBuilt & { confidentialPayload: string }> {
  const { account, sk, spendable, recipient, amountStroops, auditorId } = args;

  const client = getConfidentialChainClient();
  const recipientAccount = await client.confidentialBalance(recipient);
  if (!recipientAccount) {
    throw new Error("Recipient is not registered on the confidential token");
  }

  const kAudR = await client.auditorKey(recipientAccount.auditorId);
  const kAudS = await client.auditorKey(auditorId);

  const keys = deriveKeys(sk, addressToField(CONFIDENTIAL_TOKEN_ID));
  const witness = buildTransferWitness({
    keys,
    v: spendable.v,
    r: spendable.r,
    amount: amountStroops,
    pvkB: recipientAccount.viewingPublicKey,
    kAudR,
    kAudS,
  });

  const data = await proveAndEncode(
    transferCircuit,
    witness,
    encodeTransferData,
  );

  const built = await buildTransferTx({
    account,
    contractId: CONFIDENTIAL_TOKEN_ID,
    soroban: getSorobanContext(),
    recipient,
    data,
  });

  const kStore = deriveAccountKeys(sk, CONFIDENTIAL_TOKEN_ID).kStore;
  const cipherHex = bytesToHex(
    encryptOpening({ v: amountStroops, r: BigInt(0) }, kStore),
  );
  const confidentialPayload = btoa(
    JSON.stringify({ v: 1, cipherHex, recipient } satisfies ConfidentialPayloadV1),
  );

  return { ...built, confidentialPayload };
}

/** Withdraw from confidential balance to the public SEP-41 side (proof-carrying). */
export async function proposeWithdrawTx(args: {
  account: string;
  sk: bigint;
  spendable: Opening;
  amountStroops: bigint;
  auditorId: number;
  destination?: string;
}): Promise<ConfidentialBuilt> {
  const {
    account,
    sk,
    spendable,
    amountStroops,
    auditorId,
    destination,
  } = args;

  const client = getConfidentialChainClient();
  const kAudS = await client.auditorKey(auditorId);

  const keys = deriveKeys(sk, addressToField(CONFIDENTIAL_TOKEN_ID));
  const witness = buildWithdrawWitness({
    keys,
    v: spendable.v,
    r: spendable.r,
    amount: amountStroops,
    kAudS,
  });

  const data = await proveAndEncode(
    withdrawCircuit,
    witness,
    encodeWithdrawData,
  );

  return buildWithdrawTx({
    account,
    contractId: CONFIDENTIAL_TOKEN_ID,
    soroban: getSorobanContext(),
    destination,
    amountStroops,
    data,
  });
}
