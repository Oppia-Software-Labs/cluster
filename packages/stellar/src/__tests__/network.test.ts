import { describe, it, expect } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, getNetworkPassphrase, STELLAR_NETWORK } from "../network.js";

describe("network", () => {
  it("pins the mainnet passphrase to Networks.PUBLIC", () => {
    expect(NETWORK_PASSPHRASE).toBe(Networks.PUBLIC);
    expect(NETWORK_PASSPHRASE).toBe("Public Global Stellar Network ; September 2015");
  });

  it("exposes the network name as mainnet", () => {
    expect(STELLAR_NETWORK).toBe("mainnet");
  });

  it("getNetworkPassphrase returns the mainnet passphrase", () => {
    expect(getNetworkPassphrase()).toBe(Networks.PUBLIC);
  });
});
