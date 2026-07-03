import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const httpGet = vi.fn();
vi.mock("@/lib/http", () => ({ http: { get: (...a: unknown[]) => httpGet(...a) } }));

const signMessage = vi.fn();
vi.mock("@/lib/auth/wallet-kit", () => ({
  getWalletKit: async () => ({ signMessage }),
}));

const useAuthMock = vi.fn();
vi.mock("@/lib/auth", () => ({ useAuth: () => useAuthMock() }));

const deriveWrapKeypair = vi.fn();
const unsealSecret = vi.fn();
vi.mock("@cluster/zk", () => ({
  wrapKeyMessage: (id: string) => `wrap-key-message:${id}`,
  deriveWrapKeypair: (...a: unknown[]) => deriveWrapKeypair(...a),
  unsealSecret: (...a: unknown[]) => unsealSecret(...a),
  // Deterministic hex → bytes so we can assert what unsealSecret received.
  hexToBytes: (hex: string) =>
    Uint8Array.from(
      hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
    ),
}));

// NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID is seeded via vitest.config `test.env`
// (ESM import hoisting means a top-of-file process.env assignment would run too
// late — the hook reads the var at module-load time).
import { useConfidentialKey } from "@/lib/confidential/useConfidentialKey";

const MEMBER = "GMEMBER_ME";
const OTHER = "GMEMBER_OTHER";
const ACCOUNT = "acc-1";

beforeEach(() => {
  httpGet.mockReset();
  signMessage.mockReset();
  deriveWrapKeypair.mockReset();
  unsealSecret.mockReset();
  useAuthMock.mockReturnValue({ user: { publicKey: MEMBER } });
  // signMessage returns base64 of the bytes [1,2,3].
  signMessage.mockResolvedValue({ signedMessage: btoa("\x01\x02\x03") });
  deriveWrapKeypair.mockReturnValue({ publicKey: new Uint8Array([9]), secretKey: new Uint8Array([8]) });
});

describe("useConfidentialKey", () => {
  it("unlocks: signs the wrap-key message, fetches the member envelope, and unseals sk", async () => {
    httpGet.mockResolvedValue({
      data: [
        { accountId: ACCOUNT, memberPublicKey: OTHER, ciphertext: "ffff" },
        { accountId: ACCOUNT, memberPublicKey: MEMBER, ciphertext: "0a0b0c" },
      ],
    });
    unsealSecret.mockReturnValue(BigInt(42));

    const { result } = renderHook(() => useConfidentialKey(ACCOUNT));
    expect(result.current.sk).toBeNull();
    expect(result.current.status).toBe("locked");

    await act(async () => {
      await result.current.unlock();
    });

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(result.current.sk).toBe(BigInt(42));

    // Signed the fixed wrap-key message for the connected member.
    expect(signMessage).toHaveBeenCalledWith("wrap-key-message:CTOKEN123", {
      address: MEMBER,
    });
    // Fetched THIS account's envelopes.
    expect(httpGet).toHaveBeenCalledWith(
      `/confidential/accounts/${ACCOUNT}/envelopes`,
    );
    // Unsealed THIS member's ciphertext ("0a0b0c" → bytes) with the wrap keypair.
    const [ct] = unsealSecret.mock.calls[0];
    expect(Array.from(ct as Uint8Array)).toEqual([0x0a, 0x0b, 0x0c]);
  });

  it("surfaces 'not-provisioned' when no envelope exists for the member", async () => {
    httpGet.mockResolvedValue({
      data: [{ accountId: ACCOUNT, memberPublicKey: OTHER, ciphertext: "ffff" }],
    });

    const { result } = renderHook(() => useConfidentialKey(ACCOUNT));
    await act(async () => {
      await result.current.unlock();
    });

    await waitFor(() => expect(result.current.status).toBe("not-provisioned"));
    expect(result.current.sk).toBeNull();
    expect(unsealSecret).not.toHaveBeenCalled();
  });

  it("never persists sk to localStorage or sessionStorage", async () => {
    httpGet.mockResolvedValue({
      data: [{ accountId: ACCOUNT, memberPublicKey: MEMBER, ciphertext: "0a0b0c" }],
    });
    unsealSecret.mockReturnValue(BigInt(7));

    const localSet = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useConfidentialKey(ACCOUNT));
    await act(async () => {
      await result.current.unlock();
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    // sk lives only in memory: no storage writes containing it.
    for (const call of localSet.mock.calls) {
      expect(String(call[1])).not.toContain("7");
    }
    localSet.mockRestore();
  });

  it("never sends sk in a request body (only GETs envelopes)", async () => {
    httpGet.mockResolvedValue({
      data: [{ accountId: ACCOUNT, memberPublicKey: MEMBER, ciphertext: "0a0b0c" }],
    });
    unsealSecret.mockReturnValue(BigInt(7));

    const { result } = renderHook(() => useConfidentialKey(ACCOUNT));
    await act(async () => {
      await result.current.unlock();
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    // The hook only issues a GET; it never POSTs/PUTs the secret anywhere.
    // (http mock only exposes `get`, so any write attempt would throw.)
    expect(httpGet).toHaveBeenCalledTimes(1);
  });
});
