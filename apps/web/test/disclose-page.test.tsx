import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

// A fixed inbound (recipient) transfer the holder can disclose. `cursor` is the
// stable per-event id the picker keys on.
const RECIPIENT_TRANSFER = {
  ev: {
    type: "transfer",
    ledger: 100,
    txHash: "TXABC",
    cursor: "100-TXABC-0-0",
    from: "GFROM",
    to: "GME",
    rE: { __point: "rE" },
    sigma: BigInt(7),
    vTilde: BigInt(9),
  },
  role: "recipient" as const,
  label: "Received 42",
};

// The bundle the mocked prover returns — asserted verbatim in the <pre>.
const FIXED_BUNDLE = {
  circuitId: "disclose_recipient",
  refE: { ledger: 100, id: "100-TXABC-0-0", txHash: "TXABC" },
  proof: "0xdeadbeef",
  rDisc: { x: "0x1", y: "0x2" },
  vTildeDisc: "0x9",
};

// ── Mock the Task-22 confidential hooks ─────────────────────────────────────
const unlock = vi.fn();
vi.mock("@/lib/confidential", () => ({
  useConfidentialKey: () => ({
    sk: BigInt(123),
    status: "unlocked",
    unlock,
    isLoading: false,
    error: null,
  }),
  useConfidentialTransfers: () => ({
    transfers: [RECIPIENT_TRANSFER],
    isLoading: false,
    error: null,
  }),
}));

// ── Mock @cluster/zk (disclosure prover + key derivation) ───────────────────
const proveRecipientDisclosure = vi.fn().mockResolvedValue(FIXED_BUNDLE);
const proveSenderDisclosure = vi.fn();
const destroy = vi.fn().mockResolvedValue(undefined);
vi.mock("@cluster/zk", () => ({
  addressToField: () => BigInt(1),
  deriveKeys: () => ({
    sk: BigInt(123),
    vk: BigInt(2),
    Y: {},
    PVK: {},
    addrF: BigInt(1),
  }),
  deriveEphemeralRE: () => BigInt(5),
  proverFromArtifact: () => ({ prove: vi.fn(), destroy }),
  proveRecipientDisclosure: (...a: unknown[]) => proveRecipientDisclosure(...a),
  proveSenderDisclosure: (...a: unknown[]) => proveSenderDisclosure(...a),
  pointCoords: (p: unknown) => p,
  scalarMul: () => ({}),
  H: {},
}));

// ── Mock @cluster/zk/chain (eventRef only) ──────────────────────────────────
vi.mock("@cluster/zk/chain", () => ({
  eventRef: (ev: { ledger: number; txHash: string; cursor: string }) => ({
    ledger: ev.ledger,
    id: ev.cursor,
    txHash: ev.txHash,
  }),
}));

// ── Mock the browser prover loader + RPC client + vendored artifacts ────────
vi.mock("@/lib/bb-loader", () => ({ ensureBrowserProver: () => undefined }));
vi.mock("@/lib/zk-rpc", () => ({
  getZkRpcClient: () => ({
    confidentialBalance: async () => ({ viewingPublicKey: {} }),
  }),
}));
vi.mock("@/lib/zk-artifacts/disclose_recipient.json", () => ({
  default: { bytecode: "x" },
}));
vi.mock("@/lib/zk-artifacts/disclose_sender.json", () => ({
  default: { bytecode: "y" },
}));

import { DiscloseClient } from "@/app/(dashboard)/[accountId]/disclose/disclose-client";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const VALID_REQUEST = JSON.stringify({
  pR: { x: "0x1", y: "0x2" },
  nu: "0xnonce",
});

describe("holder /disclose flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a disclosure bundle for a selected received transfer", async () => {
    renderWithClient(<DiscloseClient accountId="acc1" />);

    // Paste the verifier's request.
    const request = screen.getByLabelText(/verifier request/i);
    await userEvent.click(request);
    await userEvent.paste(VALID_REQUEST);

    // Select the transfer and generate.
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(
      screen.getByRole("button", { name: /generate disclosure/i }),
    );

    // The fixed bundle appears in the copyable <pre>.
    await waitFor(() =>
      expect(screen.getByTestId("disclosure-bundle")).toBeInTheDocument(),
    );
    const pre = screen.getByTestId("disclosure-bundle");
    expect(pre).toHaveTextContent(/"circuitId": "disclose_recipient"/);
    expect(pre).toHaveTextContent(/"proof": "0xdeadbeef"/);

    // The recipient prover was called (not the sender one) and a copy button
    // is present.
    expect(proveRecipientDisclosure).toHaveBeenCalledTimes(1);
    expect(proveSenderDisclosure).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /copy bundle/i }),
    ).toBeInTheDocument();
  });

  it("errors on a malformed verifier request", async () => {
    renderWithClient(<DiscloseClient accountId="acc1" />);

    const request = screen.getByLabelText(/verifier request/i);
    await userEvent.click(request);
    await userEvent.paste("not json");
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(
      screen.getByRole("button", { name: /generate disclosure/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/must contain pR/i)).toBeInTheDocument(),
    );
    expect(proveRecipientDisclosure).not.toHaveBeenCalled();
    expect(screen.queryByTestId("disclosure-bundle")).not.toBeInTheDocument();
  });
});
