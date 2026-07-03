import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture the ChainConfig `getZkRpcClient` builds without touching the real
// fetch-based rpc.Server.
const chainClientCtor = vi.fn();
vi.mock("@cluster/zk/chain", () => ({
  ChainClient: class {
    constructor(cfg: unknown) {
      chainClientCtor(cfg);
    }
  },
}));

// Deterministic passphrase so the assertion below is stable.
vi.mock("@/lib/stellar-network", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

describe("getZkRpcClient", () => {
  beforeEach(() => {
    chainClientCtor.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when the RPC url env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_RPC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID", "CTOKEN");
    const { getZkRpcClient } = await import("@/lib/zk-rpc");
    expect(() => getZkRpcClient()).toThrow(/not configured/i);
  });

  it("throws a clear error when the token contract env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_RPC_URL", "https://rpc.testnet");
    vi.stubEnv("NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID", "");
    const { getZkRpcClient } = await import("@/lib/zk-rpc");
    expect(() => getZkRpcClient()).toThrow(/not configured/i);
  });

  it("builds a ChainClient from the env RPC url + token contract", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_RPC_URL", "https://rpc.testnet");
    vi.stubEnv("NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID", "CTOKEN");
    const { getZkRpcClient } = await import("@/lib/zk-rpc");
    getZkRpcClient();
    expect(chainClientCtor).toHaveBeenCalledTimes(1);
    expect(chainClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        rpcUrl: "https://rpc.testnet",
        contracts: expect.objectContaining({ token: "CTOKEN" }),
      }),
    );
  });
});
