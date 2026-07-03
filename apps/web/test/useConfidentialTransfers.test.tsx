import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────
const useAccountMock = vi.fn();
vi.mock("@/lib/queries", () => ({ useAccount: (id?: string) => useAccountMock(id) }));

const b = (n: number) => BigInt(n);

const decryptIncoming = vi.fn();
vi.mock("@cluster/zk", () => ({
  addressToField: () => BigInt(123),
  deriveKeys: () => ({ sk: BigInt(1), vk: BigInt(2), Y: {}, PVK: {}, addrF: BigInt(123) }),
  // StateEngine stub whose decryptIncoming we control.
  StateEngine: class {
    decryptIncoming(...a: unknown[]) {
      return decryptIncoming(...a);
    }
  },
}));

const hybridFetchEvents = vi.fn();
vi.mock("@cluster/zk/chain", () => ({
  ChainClient: class {
    constructor(public cfg: unknown) {}
  },
  hybridFetchEvents: (...a: unknown[]) => hybridFetchEvents(...a),
}));

// NEXT_PUBLIC_* env vars are seeded via vitest.config `test.env` (ESM import
// hoisting means top-of-file process.env assignments run after the hook module
// has already read them).
import { useConfidentialTransfers } from "@/lib/confidential/useConfidentialTransfers";

const ME = "GACCOUNT_ME";
const OTHER = "GACCOUNT_OTHER";
const ACCOUNT = "acc-1";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function transferEvent(over: Record<string, unknown>) {
  return {
    type: "transfer",
    ledger: 100,
    txHash: "abc",
    cursor: "c1",
    from: OTHER,
    to: ME,
    rE: { x: b(1), y: b(2) },
    vTilde: b(0),
    sigma: b(0),
    bTilde: b(0),
    vAudR: b(0),
    rAudR: b(0),
    vAudS: b(0),
    bAudS: b(0),
    ...over,
  };
}

beforeEach(() => {
  useAccountMock.mockReset();
  decryptIncoming.mockReset();
  hybridFetchEvents.mockReset();
  useAccountMock.mockReturnValue({ data: { stellarAccountId: ME } });
});

describe("useConfidentialTransfers", () => {
  it("maps this account's transfers to { ev, role, label }, decrypting incoming amounts", async () => {
    decryptIncoming.mockReturnValue({ vTx: b(40), rTx: b(0) });
    hybridFetchEvents.mockResolvedValue({
      events: [
        // Incoming to ME (recipient).
        transferEvent({ from: OTHER, to: ME, ledger: 100 }),
        // Outgoing from ME (sender).
        transferEvent({ from: ME, to: OTHER, ledger: 101 }),
        // Unrelated transfer (neither party is ME) — filtered out.
        transferEvent({ from: OTHER, to: "GSOMEONE", ledger: 102 }),
        // Non-transfer event — filtered out.
        { type: "deposit", ledger: 103, txHash: "d", cursor: "c", from: OTHER, to: ME, amount: b(5) },
      ],
    });

    const { result } = renderHook(
      () => useConfidentialTransfers(ACCOUNT, b(99)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { transfers } = result.current;
    expect(transfers).toHaveLength(2);

    const recipient = transfers.find((t) => t.role === "recipient");
    const sender = transfers.find((t) => t.role === "sender");

    expect(recipient?.label).toBe("Received 40");
    expect(recipient?.ev.ledger).toBe(100);
    expect(sender?.label).toBe("Sent (ledger 101)");
    expect(sender?.ev.ledger).toBe(101);

    // The RPC event source was queried read-only (no indexer).
    expect(hybridFetchEvents).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      { fromLedger: 0 },
    );
  });

  it("is disabled (no fetch) until sk is provided", async () => {
    hybridFetchEvents.mockResolvedValue({ events: [] });

    const { result } = renderHook(
      () => useConfidentialTransfers(ACCOUNT, null),
      { wrapper },
    );

    // enabled:false → the query never runs.
    await waitFor(() => expect(result.current.transfers).toEqual([]));
    expect(hybridFetchEvents).not.toHaveBeenCalled();
  });

  it("falls back to a ledger label when an incoming amount can't be decrypted", async () => {
    decryptIncoming.mockImplementation(() => {
      throw new Error("bad key");
    });
    hybridFetchEvents.mockResolvedValue({
      events: [transferEvent({ from: OTHER, to: ME, ledger: 200 })],
    });

    const { result } = renderHook(
      () => useConfidentialTransfers(ACCOUNT, b(99)),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.transfers[0].label).toBe("Received (ledger 200)");
  });
});
