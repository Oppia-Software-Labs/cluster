"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  deriveAccountKeys,
  deriveWrapKeypair,
  hexToBytes,
  unsealSecret,
  wrapKeyMessage,
  type WrapKeypair,
} from "@cluster/zk";
import type { KeyEnvelopeResponse } from "@cluster/shared";
import { http } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { getWalletKit } from "@/lib/auth/wallet-kit";
import { CONFIDENTIAL_TOKEN_ID } from "./chain";

/**
 * Session unlock lifecycle for the module-level confidential key store.
 * Mirrors {@link ConfidentialKeyState} from {@link useConfidentialKey} so UI
 * messaging stays consistent across the Z6 disclose flow and the M4 session.
 */
export type ConfidentialSessionStatus =
  | "locked"
  | "unlocking"
  | "unlocked"
  | "not-provisioned"
  | "error";

export interface ConfidentialSession {
  /**
   * The member's decrypted confidential account secret, held in the module
   * store only. `null` until `unlock()` succeeds. NEVER persisted or transmitted.
   */
  sk: bigint | null;
  status: ConfidentialSessionStatus;
  error: string | null;
  /** Sign the wrap-key message, fetch this member's envelope, and unseal `sk`. */
  unlock: () => Promise<void>;
}

interface SessionEntry {
  sk: bigint;
  kStore: Uint8Array;
}

interface SessionView {
  sk: bigint | null;
  status: ConfidentialSessionStatus;
  error: string | null;
}

const LOCKED_VIEW: SessionView = {
  sk: null,
  status: "locked",
  error: null,
};

/** Per-account unlocked secrets — memory only, never storage or network. */
const sessions = new Map<string, SessionEntry>();
const views = new Map<string, SessionView>();
const listeners = new Set<() => void>();

/** Wrap keypairs derived from wallet message signatures — one prompt per member per page load. */
const wrapKeypairCache = new Map<string, WrapKeypair>();
const wrapKeypairInflight = new Map<string, Promise<WrapKeypair>>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getView(accountId: string | undefined): SessionView {
  const key = accountId ?? "";
  return views.get(key) ?? LOCKED_VIEW;
}

function setView(accountId: string, patch: Partial<SessionView>): void {
  const prev = views.get(accountId) ?? { ...LOCKED_VIEW };
  views.set(accountId, { ...prev, ...patch });
  emitChange();
}

function setSession(accountId: string, entry: SessionEntry): void {
  sessions.set(accountId, entry);
  setView(accountId, { sk: entry.sk, status: "unlocked", error: null });
}

/** Decode a standard base64 string (wallet signMessage output) to bytes. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Derive (and cache) the signed-in member's X25519 wrap keypair from a wallet
 * **message** signature (SEP-53 `signMessage`). The wallet is prompted at most
 * once per `memberPublicKey` per page load; activation and grant-access flows
 * reuse the cached pair to publish `bytesToHex(wrap.publicKey)` or unseal
 * envelopes without a second prompt.
 */
export async function getMyWrapKeypair(
  memberPublicKey: string,
): Promise<WrapKeypair> {
  const cached = wrapKeypairCache.get(memberPublicKey);
  if (cached) return cached;

  let inflight = wrapKeypairInflight.get(memberPublicKey);
  if (!inflight) {
    inflight = (async () => {
      if (!CONFIDENTIAL_TOKEN_ID) {
        throw new Error(
          "NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID is not configured; cannot unlock confidential keys.",
        );
      }

      const kit = await getWalletKit();
      let signedMessage: string;
      try {
        const signed = await kit.signMessage(
          wrapKeyMessage(CONFIDENTIAL_TOKEN_ID),
          { address: memberPublicKey },
        );
        signedMessage = signed.signedMessage;
      } catch {
        throw new Error(
          "This wallet does not support message signing. Use Freighter or another SEP-53 capable wallet.",
        );
      }

      const walletSig = base64ToBytes(signedMessage);
      const wrap = deriveWrapKeypair(walletSig);
      wrapKeypairCache.set(memberPublicKey, wrap);
      wrapKeypairInflight.delete(memberPublicKey);
      return wrap;
    })();
    wrapKeypairInflight.set(memberPublicKey, inflight);
  }

  try {
    return await inflight;
  } catch (e) {
    wrapKeypairInflight.delete(memberPublicKey);
    throw e;
  }
}

/**
 * Read the cached storage-encryption key for an account's unlocked session.
 * Used by the signer decrypt view where hooks are awkward — returns `null` when
 * the session is locked or the account has not been unlocked yet.
 */
export function getSessionKStore(accountId: string): Uint8Array | null {
  return sessions.get(accountId)?.kStore ?? null;
}

/**
 * Shared unlocked-key session for confidential operations (M4 replacement for
 * per-component {@link useConfidentialKey} state).
 *
 * `sk` lives in a module-level map keyed by `accountId` — every component
 * calling this hook with the same id sees the same secret after one `unlock()`.
 * No React context or layout provider is required. The server-blind invariant
 * holds: `sk` and `kStore` never leave memory and are never sent to the API.
 */
export function useConfidentialSession(
  accountId?: string,
): ConfidentialSession {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => getView(accountId),
    () => getView(accountId),
  );

  const unlock = useCallback(async () => {
    if (!accountId) {
      setView("", {
        status: "error",
        error: "No account selected.",
        sk: null,
      });
      return;
    }

    setView(accountId, { error: null });

    if (!CONFIDENTIAL_TOKEN_ID) {
      setView(accountId, {
        status: "error",
        error:
          "NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID is not configured; cannot unlock confidential keys.",
      });
      return;
    }

    const memberPublicKey = user?.publicKey;
    if (!memberPublicKey) {
      setView(accountId, {
        status: "error",
        error: "You must be signed in to unlock confidential keys.",
      });
      return;
    }

    setView(accountId, { status: "unlocking" });
    try {
      const wrap = await getMyWrapKeypair(memberPublicKey);

      const { data: envelopes } = await http.get<KeyEnvelopeResponse[]>(
        `/confidential/accounts/${accountId}/envelopes`,
      );
      const mine = envelopes.find(
        (e) => e.memberPublicKey === memberPublicKey,
      );
      if (!mine) {
        setView(accountId, { sk: null, status: "not-provisioned", error: null });
        return;
      }

      const secret = unsealSecret(hexToBytes(mine.ciphertext), wrap);
      const { kStore } = deriveAccountKeys(secret, CONFIDENTIAL_TOKEN_ID);
      setSession(accountId, { sk: secret, kStore });
    } catch (e) {
      setView(accountId, {
        status: "error",
        error:
          e instanceof Error
            ? e.message
            : "Failed to unlock confidential key.",
      });
    }
  }, [accountId, user?.publicKey]);

  return {
    sk: snapshot.sk,
    status: snapshot.status,
    error: snapshot.error,
    unlock,
  };
}
