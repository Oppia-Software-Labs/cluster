import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { getRpcServer, getRpcUrl } from "../rpc.js";

const SAVED_VARS = [
  "STELLAR_RPC_URL",
  "STELLAR_TESTNET_RPC_URL",
  "STELLAR_NETWORK",
] as const;
const ORIGINAL = Object.fromEntries(SAVED_VARS.map((k) => [k, process.env[k]]));

describe("rpc", () => {
  beforeEach(() => {
    for (const k of SAVED_VARS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of SAVED_VARS) {
      if (ORIGINAL[k] === undefined) delete process.env[k];
      else process.env[k] = ORIGINAL[k];
    }
  });

  it("throws a clear error when STELLAR_RPC_URL is unset", () => {
    expect(() => getRpcUrl()).toThrow(/STELLAR_RPC_URL/);
  });

  it("reads STELLAR_RPC_URL from the environment", () => {
    process.env.STELLAR_RPC_URL = "https://rpc.example.org";
    expect(getRpcUrl()).toBe("https://rpc.example.org");
  });

  it("constructs an rpc.Server pointed at the env URL", () => {
    process.env.STELLAR_RPC_URL = "https://rpc.example.org";
    const server = getRpcServer();
    expect(server).toBeInstanceOf(rpc.Server);
  });

  it("uses the testnet override for an explicit testnet request on mainnet", () => {
    process.env.STELLAR_RPC_URL = "https://rpc.example.org";
    process.env.STELLAR_TESTNET_RPC_URL = "https://testnet-rpc.example.org";
    expect(getRpcUrl("testnet")).toBe("https://testnet-rpc.example.org");
  });

  it("uses STELLAR_RPC_URL for everything when the active network is testnet", () => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.STELLAR_RPC_URL = "https://testnet-rpc.example.org";
    expect(getRpcUrl()).toBe("https://testnet-rpc.example.org");
    expect(getRpcUrl("testnet")).toBe("https://testnet-rpc.example.org");
  });

  it("refuses a mainnet request while the active network is testnet", () => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.STELLAR_RPC_URL = "https://testnet-rpc.example.org";
    expect(() => getRpcUrl("mainnet")).toThrow(/mainnet/);
  });
});
