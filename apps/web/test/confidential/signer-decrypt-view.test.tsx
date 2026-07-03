import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bytesToHex, encryptOpening } from "@cluster/zk";
import type { Transaction } from "@cluster/shared";

import { SignerDecryptView } from "@/components/confidential/signer-decrypt-view";

const ACCOUNT = "acc-1";
const RECIPIENT = "GDESTINATONKEY123456789012345678901234567890";

const kStore = new Uint8Array(32);
kStore.fill(0xab);

const cipherHex = bytesToHex(
  encryptOpening({ v: BigInt(400_000_000), r: BigInt(0) }, kStore),
);

const confidentialPayload = btoa(
  JSON.stringify({ v: 1, cipherHex, recipient: RECIPIENT }),
);

const baseTx: Transaction = {
  id: "tx-1",
  accountId: ACCOUNT,
  type: "confidential",
  confidentialOp: "transfer",
  confidentialPayload,
  xdr: "AAAA",
  status: "pending",
  requiredThreshold: 2,
  proposedBy: "GPROP",
  memo: null,
  network: "testnet",
  submittedHash: null,
  lastError: null,
};

const { getSessionKStore } = vi.hoisted(() => ({
  getSessionKStore: vi.fn<(accountId: string) => Uint8Array | null>(),
}));

vi.mock("@/lib/confidential/session", () => ({
  useConfidentialSession: () => ({
    sk: BigInt(1),
    status: "unlocked",
    error: null,
    unlock: vi.fn(),
  }),
  getSessionKStore,
}));

beforeEach(() => {
  getSessionKStore.mockClear();
  getSessionKStore.mockReturnValue(kStore);
});

describe("SignerDecryptView", () => {
  it("shows the correct decrypted amount and recipient when unlocked", () => {
    render(<SignerDecryptView tx={baseTx} />);

    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText(/XLM/)).toBeInTheDocument();
    expect(
      screen.getByText(`→ ${RECIPIENT.slice(0, 4)}…${RECIPIENT.slice(-4)}`),
    ).toBeInTheDocument();
    expect(getSessionKStore).toHaveBeenCalledWith(ACCOUNT);
  });

  it("shows could-not-decrypt when the ciphertext is tampered", () => {
    const tamperedHex =
      cipherHex[0] === "a"
        ? "b" + cipherHex.slice(1)
        : "a" + cipherHex.slice(1);
    const tamperedPayload = btoa(
      JSON.stringify({ v: 1, cipherHex: tamperedHex, recipient: RECIPIENT }),
    );

    render(
      <SignerDecryptView
        tx={{ ...baseTx, confidentialPayload: tamperedPayload }}
      />,
    );

    expect(
      screen.getByText("Could not decrypt this transfer with your key."),
    ).toBeInTheDocument();
    expect(screen.queryByText("40")).not.toBeInTheDocument();
  });
});
