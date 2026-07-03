import { describe, it, expect, afterEach } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import {
  MAINNET_NETWORK_PASSPHRASE,
  TESTNET_NETWORK_PASSPHRASE,
  getNetworkPassphrase,
  getStellarNetwork,
} from "../network.js";

const ORIGINAL = process.env.STELLAR_NETWORK;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STELLAR_NETWORK;
  else process.env.STELLAR_NETWORK = ORIGINAL;
});

describe("network", () => {
  it("pins the passphrases to the SDK constants", () => {
    expect(MAINNET_NETWORK_PASSPHRASE).toBe(Networks.PUBLIC);
    expect(MAINNET_NETWORK_PASSPHRASE).toBe(
      "Public Global Stellar Network ; September 2015",
    );
    expect(TESTNET_NETWORK_PASSPHRASE).toBe(Networks.TESTNET);
  });

  it("defaults to mainnet when STELLAR_NETWORK is unset", () => {
    delete process.env.STELLAR_NETWORK;
    expect(getStellarNetwork()).toBe("mainnet");
    expect(getNetworkPassphrase()).toBe(Networks.PUBLIC);
  });

  it("switches to testnet via STELLAR_NETWORK", () => {
    process.env.STELLAR_NETWORK = "testnet";
    expect(getStellarNetwork()).toBe("testnet");
    expect(getNetworkPassphrase()).toBe(Networks.TESTNET);
  });

  it("rejects an unrecognized STELLAR_NETWORK value", () => {
    process.env.STELLAR_NETWORK = "futurenet";
    expect(() => getStellarNetwork()).toThrow(/futurenet/);
  });

  it("getNetworkPassphrase resolves an explicit network regardless of env", () => {
    process.env.STELLAR_NETWORK = "mainnet";
    expect(getNetworkPassphrase("testnet")).toBe(Networks.TESTNET);
    expect(getNetworkPassphrase("mainnet")).toBe(Networks.PUBLIC);
  });
});
