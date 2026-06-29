import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { getRpcServer, getRpcUrl } from "../rpc.js";

const ORIGINAL = process.env.STELLAR_RPC_URL;

describe("rpc", () => {
  beforeEach(() => {
    delete process.env.STELLAR_RPC_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.STELLAR_RPC_URL;
    else process.env.STELLAR_RPC_URL = ORIGINAL;
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
});
