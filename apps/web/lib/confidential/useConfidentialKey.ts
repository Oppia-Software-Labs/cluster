"use client";

import { useCallback, useState } from "react";
import {
  deriveWrapKeypair,
  hexToBytes,
  unsealSecret,
  wrapKeyMessage,
} from "@cluster/zk";
import type { KeyEnvelopeResponse } from "@cluster/shared";
import { http } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { getWalletKit } from "@/lib/auth/wallet-kit";

/** Confidential-token contract the account's keys are bound to. */
const TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID ?? "";

/**
 * `unlock()` can fail before the wallet is even reached (no contract
 * configured, no session), while the wallet declining is a distinct state.
 * Kept as a small union so the disclose page can message each case.
 */
export type ConfidentialKeyState =
  | "locked"
  | "unlocking"
  | "unlocked"
  | "not-provisioned"
  | "error";

export interface UseConfidentialKey {
  /**
   * The member's decrypted confidential account secret, held in memory only.
   * `null` until `unlock()` succeeds. NEVER persisted or transmitted.
   */
  sk: bigint | null;
  status: ConfidentialKeyState;
  isLoading: boolean;
  error: string | null;
  /** Sign the wrap-key message, fetch this member's envelope, and unseal `sk`. */
  unlock: () => Promise<void>;
}

/**
 * Unwrap the signed-in member's confidential account secret (`sk`) for an
 * account, entirely client-side (minimal Z5 for the Z6 disclose flow).
 *
 * The secret is derived from a wallet **message** signature (SEP-53
 * `signMessage`), NOT a transaction signature: `deriveWrapKeypair(sig)` yields
 * an X25519 wrap keypair, the API returns this member's sealed envelope, and
 * `unsealSecret` opens it. `sk` lives in React state (memory) for the session
 * only — it is never written to storage and never sent back to any server.
 */
export function useConfidentialKey(
  accountId: string | undefined,
): UseConfidentialKey {
  const { user } = useAuth();
  const [sk, setSk] = useState<bigint | null>(null);
  const [status, setStatus] = useState<ConfidentialKeyState>("locked");
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    setError(null);

    if (!accountId) {
      setStatus("error");
      setError("No account selected.");
      return;
    }
    if (!TOKEN_CONTRACT_ID) {
      setStatus("error");
      setError(
        "NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID is not configured; cannot unlock confidential keys.",
      );
      return;
    }
    const memberPublicKey = user?.publicKey;
    if (!memberPublicKey) {
      setStatus("error");
      setError("You must be signed in to unlock confidential keys.");
      return;
    }

    setStatus("unlocking");
    try {
      // 1. Wallet message signature over the fixed wrap-key message.
      const kit = await getWalletKit();
      let signedMessage: string;
      try {
        const signed = await kit.signMessage(wrapKeyMessage(TOKEN_CONTRACT_ID), {
          address: memberPublicKey,
        });
        signedMessage = signed.signedMessage;
      } catch {
        throw new Error(
          "This wallet does not support message signing. Use Freighter or another SEP-53 capable wallet.",
        );
      }

      // The kit returns the signature base64-encoded; decode to raw bytes for
      // the key-derivation KDF.
      const walletSig = base64ToBytes(signedMessage);
      const wrap = deriveWrapKeypair(walletSig);

      // 2. Fetch this member's sealed envelope for the account.
      const { data: envelopes } = await http.get<KeyEnvelopeResponse[]>(
        `/confidential/accounts/${accountId}/envelopes`,
      );
      const mine = envelopes.find(
        (e) => e.memberPublicKey === memberPublicKey,
      );
      if (!mine) {
        setStatus("not-provisioned");
        return;
      }

      // 3. Unseal the secret. Ciphertext is hex-encoded over the wire.
      const secret = unsealSecret(hexToBytes(mine.ciphertext), wrap);
      setSk(secret);
      setStatus("unlocked");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to unlock confidential key.");
    }
  }, [accountId, user?.publicKey]);

  return {
    sk,
    status,
    isLoading: status === "unlocking",
    error,
    unlock,
  };
}

/** Decode a standard base64 string (wallet signMessage output) to bytes. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
