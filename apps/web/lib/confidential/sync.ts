"use client";

import { useQuery } from "@tanstack/react-query";
import type { OpeningBlobResponse } from "@cluster/shared";
import {
  StateEngine,
  addressToField,
  deriveKeys,
  deriveAccountKeys,
  encryptOpening,
  decryptOpening,
  bytesToHex,
  hexToBytes,
  pointToBytes,
  type StateStore,
  type AccountState,
  type Opening,
  type ConfidentialEvent,
} from "@cluster/zk";
import {
  hybridFetchEvents,
  type ConfidentialEvent as ChainEvent,
} from "@cluster/zk/chain";
import { http } from "@/lib/http";
import { useAccount } from "@/lib/queries";
import { CONFIDENTIAL_TOKEN_ID, getConfidentialChainClient } from "./chain";

const SPENDABLE_KEY = "state:v1:spendable";
const RECEIVING_KEY = "state:v1:receiving";
const LAST_LEDGER_KEY = "state:v1:lastLedger";

export interface ConfidentialSyncResult {
  state: AccountState;
  spendable: Opening;
  receiving: Opening;
  /** Whether reconstructed openings match the on-chain commitment points. */
  verified: boolean;
  engine: StateEngine;
}

/**
 * Server-backed {@link StateStore} for reconstructed confidential openings.
 *
 * Persistence rides the API's opaque openings channel (`PUT/GET
 * /confidential/accounts/:id/openings`). Spendable and receiving openings are
 * encrypted under the account's `kStore`; `lastLedger` is stored in plaintext
 * because a ledger sequence number is not sensitive — it only drives incremental
 * event replay.
 */
export class ApiStateStore implements StateStore {
  constructor(
    private readonly accountId: string,
    private readonly kStore: Uint8Array,
  ) {}

  async save(address: string, state: AccountState): Promise<void> {
    void address;
    await Promise.all([
      http.put(`/confidential/accounts/${this.accountId}/openings`, {
        eventKey: SPENDABLE_KEY,
        ciphertext: bytesToHex(encryptOpening(state.spendable, this.kStore)),
      }),
      http.put(`/confidential/accounts/${this.accountId}/openings`, {
        eventKey: RECEIVING_KEY,
        ciphertext: bytesToHex(encryptOpening(state.receiving, this.kStore)),
      }),
      http.put(`/confidential/accounts/${this.accountId}/openings`, {
        eventKey: LAST_LEDGER_KEY,
        // Plaintext — a ledger number is not sensitive; only used to resume replay.
        ciphertext: String(state.lastLedger),
      }),
    ]);
  }

  async load(address: string): Promise<AccountState | null> {
    void address;
    const { data: openings } = await http.get<OpeningBlobResponse[]>(
      `/confidential/accounts/${this.accountId}/openings`,
    );
    const byKey = new Map(openings.map((o) => [o.eventKey, o.ciphertext]));

    const spendableHex = byKey.get(SPENDABLE_KEY);
    const receivingHex = byKey.get(RECEIVING_KEY);
    const lastLedgerRaw = byKey.get(LAST_LEDGER_KEY);
    if (!spendableHex || !receivingHex || lastLedgerRaw == null) return null;

    return {
      spendable: decryptOpening(hexToBytes(spendableHex), this.kStore),
      receiving: decryptOpening(hexToBytes(receivingHex), this.kStore),
      lastLedger: Number(lastLedgerRaw),
    };
  }
}

/** Keep events that touch this account (any direction field the engine reads). */
function isEventForAddress(
  address: string,
): (ev: ChainEvent) => boolean {
  return (ev) => {
    switch (ev.type) {
      case "register":
        return ev.account === address;
      case "deposit":
        return ev.from === address || ev.to === address;
      case "merge":
        return ev.account === address;
      case "withdraw":
        return ev.from === address || ev.to === address;
      case "transfer":
        return ev.from === address || ev.to === address;
    }
  };
}

/**
 * Reconstruct confidential account state from chain events, persisting openings
 * via {@link ApiStateStore}. Resumes from `lastLedger + 1` so receiving-balance
 * replay stays idempotent — `ingestEvents` is a running sum over credits, and
 * re-applying an old credit would double-count.
 */
export async function syncConfidentialState(args: {
  accountId: string;
  address: string;
  sk: bigint;
}): Promise<ConfidentialSyncResult> {
  const { accountId, address, sk } = args;
  const addrF = addressToField(CONFIDENTIAL_TOKEN_ID);
  const keys = deriveKeys(sk, addrF);
  const { kStore } = deriveAccountKeys(sk, CONFIDENTIAL_TOKEN_ID);

  const engine = new StateEngine({
    keys,
    address,
    store: new ApiStateStore(accountId, kStore),
  });
  const prior = await engine.load();

  const client = getConfidentialChainClient();
  const { events } = await hybridFetchEvents(client, undefined, {
    fromLedger: prior.lastLedger + 1,
  });
  const filtered = events
    .filter(isEventForAddress(address))
    .map((ev) => ev as ConfidentialEvent);
  engine.ingestEvents(filtered);

  const onchain = await client.confidentialBalance(address);
  let verified = false;
  if (onchain) {
    verified = engine.verifyAgainstChain({
      spendableC: pointToBytes(onchain.spendableBalance),
      receivingC: pointToBytes(onchain.receivingBalance),
    }).ok;
  }

  return {
    state: engine.state(),
    spendable: engine.spendable(),
    receiving: engine.receiving(),
    verified,
    engine,
  };
}

/**
 * React-query wrapper around {@link syncConfidentialState}. Requires the account
 * Stellar address (via {@link useAccount}) and an unlocked `sk` from
 * {@link useConfidentialSession}. Exposes `lastSyncedAt` as TanStack Query's
 * `dataUpdatedAt` for UI freshness indicators.
 */
export function useConfidentialSync(
  accountId?: string,
  sk?: bigint | null,
) {
  const { data: account } = useAccount(accountId);
  const address = account?.stellarAccountId;

  const query = useQuery({
    queryKey: ["confidential-sync", accountId, sk?.toString()],
    enabled: Boolean(
      accountId && address && sk != null && CONFIDENTIAL_TOKEN_ID,
    ),
    queryFn: () =>
      syncConfidentialState({
        accountId: accountId as string,
        address: address as string,
        sk: sk as bigint,
      }),
  });

  return {
    ...query,
    lastSyncedAt: query.dataUpdatedAt,
  };
}
