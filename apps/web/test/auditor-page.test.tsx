import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Two synthetic events: one transfer (amount decrypted via auditTransfer) and
// one withdraw (amount is public on the event). Both in stroops.
const EVENTS = [
  {
    type: "transfer",
    txHash: "TXTRANSFER",
    ledger: 100,
    rE: {},
    sigma: BigInt(1),
    vAudS: BigInt(0),
    bAudS: BigInt(0),
    vAudR: BigInt(0),
    rAudR: BigInt(0),
  },
  {
    type: "withdraw",
    txHash: "TXWITHDRAW",
    ledger: 101,
    amount: BigInt(50_000_000), // 5 XLM, public
    rE: {},
    sigma: BigInt(1),
    bAudS: BigInt(0),
  },
];

// ── Mock @cluster/zk (hex→scalar helper) ────────────────────────────────────
vi.mock("@cluster/zk", () => ({
  fromHex: (h: string) => BigInt(h.startsWith("0x") ? h : "0x" + h),
}));

// ── Mock @cluster/zk/chain (fetch + audit decrypt) ──────────────────────────
const hybridFetchEvents = vi
  .fn()
  .mockResolvedValue({ events: EVENTS, cursor: undefined, latestLedger: 200 });
vi.mock("@cluster/zk/chain", () => ({
  hybridFetchEvents: (...a: unknown[]) => hybridFetchEvents(...a),
  // 400_000_000 stroops = 40 XLM.
  auditTransfer: () => ({
    amount: BigInt(400_000_000),
    senderBalance: BigInt(0),
    rTx: BigInt(0),
    channelsAgree: true,
  }),
  auditWithdraw: () => ({ senderBalance: BigInt(0) }),
}));

// ── Mock the wallet-free RPC client ─────────────────────────────────────────
vi.mock("@/lib/zk-rpc", () => ({
  getZkRpcClient: () => ({ cfg: { contracts: { token: "CTOKEN" } } }),
}));

import { AuditorClient } from "@/app/auditor/auditor-client";

describe("public /auditor console", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Load-bearing public-ness assertion: NO AuthProvider, NO QueryClient, NO
  // wallet. A bare render must work — if the component ever imported useAuth or
  // the wallet kit, this would throw (same guard as /verify).
  it("renders the secret gate with no session/provider in the tree", () => {
    render(<AuditorClient />);
    expect(
      screen.getByRole("heading", { name: /auditor access/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/auditor secret/i)).toBeInTheDocument();
    // No table before unlocking.
    expect(screen.queryByTestId("audit-row")).not.toBeInTheDocument();
  });

  it("unlocks with a typed hex secret and lists decrypted rows", async () => {
    render(<AuditorClient />);

    await userEvent.type(screen.getByLabelText(/auditor secret/i), "0xabcd");
    await userEvent.click(
      screen.getByRole("button", { name: /unlock & audit/i }),
    );

    await waitFor(() =>
      expect(screen.getAllByTestId("audit-row")).toHaveLength(2),
    );

    // The transfer row shows the auditTransfer amount (40 XLM); the withdraw row
    // shows the event's public amount (5 XLM).
    expect(screen.getByText("TXTRANSFER")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("TXWITHDRAW")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // The secret went nowhere near the RPC fetch (indexer arg is undefined).
    expect(hybridFetchEvents).toHaveBeenCalledWith(expect.anything(), undefined, {
      fromLedger: 0,
    });
  });
});
