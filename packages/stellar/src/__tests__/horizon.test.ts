import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getHorizonUrl } from "../horizon.js";

const SAVED_VARS = [
  "STELLAR_HORIZON_URL",
  "STELLAR_TESTNET_HORIZON_URL",
  "STELLAR_NETWORK",
] as const;
const ORIGINAL = Object.fromEntries(SAVED_VARS.map((k) => [k, process.env[k]]));

describe("horizon", () => {
  beforeEach(() => {
    for (const k of SAVED_VARS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of SAVED_VARS) {
      if (ORIGINAL[k] === undefined) delete process.env[k];
      else process.env[k] = ORIGINAL[k];
    }
  });

  it("throws a clear error when STELLAR_HORIZON_URL is unset", () => {
    expect(() => getHorizonUrl()).toThrow(/STELLAR_HORIZON_URL/);
  });

  it("reads STELLAR_HORIZON_URL from the environment", () => {
    process.env.STELLAR_HORIZON_URL = "https://horizon.example.org";
    expect(getHorizonUrl()).toBe("https://horizon.example.org");
  });

  it("reads STELLAR_HORIZON_URL for an explicit mainnet request on mainnet", () => {
    process.env.STELLAR_HORIZON_URL = "https://horizon.example.org";
    expect(getHorizonUrl("mainnet")).toBe("https://horizon.example.org");
  });

  it("uses the testnet override for an explicit testnet request on mainnet", () => {
    process.env.STELLAR_HORIZON_URL = "https://horizon.example.org";
    process.env.STELLAR_TESTNET_HORIZON_URL =
      "https://testnet-horizon.example.org";
    expect(getHorizonUrl("testnet")).toBe("https://testnet-horizon.example.org");
  });

  it("throws when the testnet override is requested but unset", () => {
    process.env.STELLAR_HORIZON_URL = "https://horizon.example.org";
    expect(() => getHorizonUrl("testnet")).toThrow(
      /STELLAR_TESTNET_HORIZON_URL/,
    );
  });

  it("uses STELLAR_HORIZON_URL for everything when the active network is testnet", () => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.STELLAR_HORIZON_URL = "https://testnet-horizon.example.org";
    expect(getHorizonUrl()).toBe("https://testnet-horizon.example.org");
    expect(getHorizonUrl("testnet")).toBe("https://testnet-horizon.example.org");
  });

  it("refuses a mainnet request while the active network is testnet", () => {
    process.env.STELLAR_NETWORK = "testnet";
    process.env.STELLAR_HORIZON_URL = "https://testnet-horizon.example.org";
    expect(() => getHorizonUrl("mainnet")).toThrow(/mainnet/);
  });
});
