import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// A valid bundle and a tampered copy (proof mutated). parseBundle (which lives
// inside the component, unmocked) accepts both shapes; the mocked
// verifyDisclosure below is what distinguishes them.
const VALID = JSON.stringify({
  circuitId: "disclose_recipient",
  refE: { ledger: 42, id: "e1", txHash: "abc123" },
  proof: "deadbeef",
  rDisc: { x: "0x1", y: "0x2" },
  vTildeDisc: "0x9",
});
const TAMPERED = VALID.replace("deadbeef", "00ff");

// ── Mock @cluster/zk ────────────────────────────────────────────────────────
// verifyDisclosure returns {ok,amount,...} for the valid proof and THROWS a
// DisclosureVerifyError for anything else — matching the real contract (it
// never returns {ok:false}).
const destroy = vi.fn().mockResolvedValue(undefined);
vi.mock("@cluster/zk", () => {
  class DisclosureVerifyError extends Error {
    constructor(
      readonly stage: string,
      message: string,
    ) {
      super(`[${stage}] ${message}`);
      this.name = "DisclosureVerifyError";
    }
  }
  return {
  DISCLOSE_SENDER_CIRCUIT_ID: "disclose_sender",
  DisclosureVerifyError,
  addressToField: () => BigInt(1),
  generateRecipientKeys: () => ({ rR: BigInt(1), pR: { x: "0x1", y: "0x1" } }),
  recipientKeysFromSecret: () => ({ rR: BigInt(1), pR: { x: "0x1", y: "0x1" } }),
  newDisclosureRequest: () => ({ pR: { x: "0x1", y: "0x1" }, nu: "0xn" }),
  proverFromArtifact: () => ({ destroy }),
  pointFromJson: (p: unknown) => p,
  toHex32: (v: unknown) => String(v),
  fromHex: (v: string) => BigInt(0),
  verifyDisclosure: async (bundle: { proof: string }) => {
    if (bundle.proof !== "deadbeef") {
      throw new DisclosureVerifyError(
        "verify-proof",
        "UltraHonk proof verification failed",
      );
    }
    return {
      ok: true as const,
      amount: BigInt(400_000_000), // 40 XLM
      role: "recipient" as const,
      disclosingAccount: "GDISCLOSER",
      steps: [],
    };
  },
  };
});

// ── Mock @cluster/zk/chain ──────────────────────────────────────────────────
vi.mock("@cluster/zk/chain", () => ({
  hybridResolveEventRef: async () => ({
    type: "transfer",
    from: "GFROM",
    to: "GTO",
    rE: { x: BigInt(1), y: BigInt(2) },
    sigma: BigInt(3),
    vTilde: BigInt(4),
    txHash: "abc123",
    ledger: 42,
  }),
}));

// ── Mock the RPC client + browser prover loader ─────────────────────────────
vi.mock("@/lib/zk-rpc", () => ({
  getZkRpcClient: () => ({
    cfg: { contracts: { token: "CTOKEN" } },
    confidentialBalance: async () => ({ viewingPublicKey: { x: BigInt(9), y: BigInt(9) } }),
  }),
}));
vi.mock("@/lib/bb-loader", () => ({ ensureBrowserProver: () => undefined }));

// ── Mock the vendored JSON artifacts (bundle.circuitId must be a known key) ──
vi.mock("@/lib/zk-artifacts/disclose_recipient.json", () => ({
  default: { bytecode: "x" },
}));
vi.mock("@/lib/zk-artifacts/disclose_recipient.vk.json", () => ({
  default: { vkBase64: "AA==" },
}));
vi.mock("@/lib/zk-artifacts/disclose_sender.json", () => ({
  default: { bytecode: "y" },
}));
vi.mock("@/lib/zk-artifacts/disclose_sender.vk.json", () => ({
  default: { vkBase64: "AA==" },
}));

import { VerifyClient } from "@/app/verify/verify-client";

describe("public /verify page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // Load-bearing public-ness assertion: NO AuthProvider, NO QueryClient, NO
  // wallet. If the component ever imported useAuth or the wallet kit, this bare
  // render would throw.
  it("renders with no session/provider in the tree", () => {
    render(<VerifyClient />);
    expect(
      screen.getByRole("heading", { name: /verify a disclosure/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no wallet, no sign-in/i)).toBeInTheDocument();
  });

  it("verifies a valid bundle and shows the amount", async () => {
    render(<VerifyClient />);
    const textarea = screen.getByLabelText(/^disclosure bundle$/i);
    await userEvent.click(textarea);
    await userEvent.paste(VALID);
    await userEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByText(/disclosure verified/i)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("disclosed-amount")).toHaveTextContent("40 XLM");
  });

  it("rejects a tampered bundle", async () => {
    render(<VerifyClient />);
    const textarea = screen.getByLabelText(/^disclosure bundle$/i);
    await userEvent.click(textarea);
    await userEvent.paste(TAMPERED);
    await userEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByText(/not verified/i)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("disclosed-amount")).not.toBeInTheDocument();
  });
});
