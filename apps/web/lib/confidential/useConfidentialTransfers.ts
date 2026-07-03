"use client";

import { useQuery } from "@tanstack/react-query";
import {
  StateEngine,
  addressToField,
  deriveKeys,
} from "@cluster/zk";
import {
  ChainClient,
  hybridFetchEvents,
  type ConfidentialEvent,
  type TransferEvent,
} from "@cluster/zk/chain";
import { useAccount } from "@/lib/queries";
import { NETWORK_PASSPHRASE } from "@/lib/stellar-network";

const TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID ?? "";
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "";
// Auditor/verifier contracts are not needed for read-only event fetching, but
// ChainConfig requires the full triple; the token id is the only one read here.
const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_VERIFIER_CONTRACT_ID ?? TOKEN_CONTRACT_ID;
const AUDITOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_CONTRACT_ID ?? TOKEN_CONTRACT_ID;

export type ConfidentialTransferRole = "recipient" | "sender";

export interface DecryptedTransfer {
  /** The raw on-chain transfer event. */
  ev: TransferEvent;
  /** Whether this account received (`recipient`) or sent (`sender`) the transfer. */
  role: ConfidentialTransferRole;
  /** Human-readable one-line summary for the disclose picker. */
  label: string;
}

export interface UseConfidentialTransfers {
  transfers: DecryptedTransfer[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * List this account's confidential transfers, decrypted where possible
 * (minimal, read-only Z5 for the Z6 disclose flow).
 *
 * Given the account secret `sk` (from {@link useConfidentialKey}), the account
 * keys are re-derived and every incoming transfer's amount is recovered with
 * the state engine's `decryptIncoming`. Events are pulled straight from the
 * Soroban RPC (read-only, no indexer, no persistence, no re-encryption — the
 * full sync/persist engine is out of scope here).
 *
 * `sk` is passed in rather than read internally so the hook stays a pure
 * read: `const { sk } = useConfidentialKey(id); const { transfers } =
 * useConfidentialTransfers(id, sk);`.
 */
export function useConfidentialTransfers(
  accountId: string | undefined,
  sk: bigint | null,
): UseConfidentialTransfers {
  const { data: account } = useAccount(accountId);
  const address = account?.stellarAccountId;

  const query = useQuery({
    queryKey: [accountId, "confidential-transfers", address, sk?.toString()],
    enabled: Boolean(accountId && address && sk && TOKEN_CONTRACT_ID && RPC_URL),
    queryFn: async (): Promise<DecryptedTransfer[]> => {
      // Guarded by `enabled`, but narrow for the type checker.
      if (!address || sk == null) return [];

      const addrF = addressToField(TOKEN_CONTRACT_ID);
      const engine = new StateEngine({
        address,
        keys: deriveKeys(sk, addrF),
      });

      const client = new ChainClient({
        rpcUrl: RPC_URL,
        networkPassphrase: NETWORK_PASSPHRASE,
        contracts: {
          token: TOKEN_CONTRACT_ID,
          verifier: VERIFIER_CONTRACT_ID,
          auditor: AUDITOR_CONTRACT_ID,
        },
      });

      // fromLedger: 0 lets the RPC clamp to its oldest served ledger (~7-day
      // retention window). Read-only, no indexer.
      const { events } = await hybridFetchEvents(client, undefined, {
        fromLedger: 0,
      });

      return events
        .filter(isMyTransfer(address))
        .map((ev) => toDecryptedTransfer(ev, address, engine));
    },
  });

  return {
    transfers: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

/** Keep only transfer events this account is a party to. */
function isMyTransfer(
  address: string,
): (ev: ConfidentialEvent) => ev is TransferEvent {
  return (ev): ev is TransferEvent =>
    ev.type === "transfer" && (ev.from === address || ev.to === address);
}

function toDecryptedTransfer(
  ev: TransferEvent,
  address: string,
  engine: StateEngine,
): DecryptedTransfer {
  const role: ConfidentialTransferRole =
    ev.to === address ? "recipient" : "sender";

  let label: string;
  if (role === "recipient") {
    try {
      const { vTx } = engine.decryptIncoming(ev.rE, ev.vTilde, ev.sigma);
      label = `Received ${vTx.toString()}`;
    } catch {
      // Couldn't recover the amount (wrong key, malformed event) — fall back to
      // an identifying label rather than dropping the transfer.
      label = `Received (ledger ${ev.ledger})`;
    }
  } else {
    // The sender channel doesn't ECDH-decrypt the plaintext amount here; the
    // spendable checkpoint is not a per-transfer amount, so we label by ledger.
    label = `Sent (ledger ${ev.ledger})`;
  }

  return { ev, role, label };
}
