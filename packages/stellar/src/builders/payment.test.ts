import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Account, Keypair } from "@stellar/stellar-sdk";
import { PaymentBuilder } from "./payment.js";
import { MAINNET_NETWORK_PASSPHRASE as NETWORK_PASSPHRASE } from "../network.js";

const source = Keypair.random();
const destination = Keypair.random();

describe("PaymentBuilder", () => {
  const originalRpcUrl = process.env.STELLAR_RPC_URL;

  beforeEach(() => {
    process.env.STELLAR_RPC_URL = "https://rpc.example.com";
  });

  afterEach(() => {
    if (originalRpcUrl === undefined) {
      delete process.env.STELLAR_RPC_URL;
    } else {
      process.env.STELLAR_RPC_URL = originalRpcUrl;
    }
    vi.restoreAllMocks();
  });

  it("builds a native payment XDR with a mocked RPC server", async () => {
    const mockAccount = new Account(source.publicKey(), "123456789");
    const getAccount = vi.fn().mockResolvedValue(mockAccount);
    const server = { getAccount } as any;

    vi.spyOn(await import("../rpc.js"), "getRpcServer").mockReturnValue(server);

    const builder = new PaymentBuilder();
    const built = await builder.build({
      source: source.publicKey(),
      destination: destination.publicKey(),
      asset: "native",
      amount: "10",
      memo: "test payment",
    });

    expect(getAccount).toHaveBeenCalledWith(source.publicKey());
    expect(built.type).toBe("payment");
    expect(built.thresholdLevel).toBe("medium");
    expect(built.xdr.length).toBeGreaterThan(0);

    const { TransactionBuilder } = await import("@stellar/stellar-sdk");
    const tx = TransactionBuilder.fromXDR(built.xdr, NETWORK_PASSPHRASE);
    expect(tx.operations).toHaveLength(1);
  });
});
