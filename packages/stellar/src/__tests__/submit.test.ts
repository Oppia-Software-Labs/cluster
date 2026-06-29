import { describe, it, expect, vi } from "vitest";
import { Api } from "@stellar/stellar-sdk/rpc";
import { submitSignedXdr } from "../submit.js";
import { buildUnsignedXdr, signatureFor, signerA } from "./fixtures.js";
import { combineSignatures } from "../signatures.js";
import { NETWORK_PASSPHRASE } from "../network.js";

function signedXdr(): string {
  const xdr = buildUnsignedXdr();
  return combineSignatures(
    xdr,
    [{ signerPublicKey: signerA.publicKey(), signatureXdr: signatureFor(xdr, signerA) }],
    NETWORK_PASSPHRASE,
  );
}

describe("submitSignedXdr", () => {
  it("sends the transaction then polls to SUCCESS", async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: Api.GetTransactionStatus.NOT_FOUND })
      .mockResolvedValueOnce({ status: Api.GetTransactionStatus.SUCCESS });
    const server = {
      sendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "abc123" }),
      getTransaction,
    } as any;

    const result = await submitSignedXdr(signedXdr(), {
      server,
      networkPassphrase: NETWORK_PASSPHRASE,
      pollIntervalMs: 0,
      maxPolls: 5,
    });

    expect(server.sendTransaction).toHaveBeenCalledOnce();
    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ hash: "abc123", status: Api.GetTransactionStatus.SUCCESS });
  });

  it("throws immediately if sendTransaction returns ERROR", async () => {
    const server = {
      sendTransaction: vi
        .fn()
        .mockResolvedValue({ status: "ERROR", hash: "abc123", errorResult: {} }),
      getTransaction: vi.fn(),
    } as any;

    await expect(
      submitSignedXdr(signedXdr(), { server, networkPassphrase: NETWORK_PASSPHRASE, pollIntervalMs: 0 }),
    ).rejects.toThrow(/ERROR/);
    expect(server.getTransaction).not.toHaveBeenCalled();
  });

  it("returns FAILED status when the transaction is included but fails", async () => {
    const server = {
      sendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "h" }),
      getTransaction: vi.fn().mockResolvedValue({ status: Api.GetTransactionStatus.FAILED }),
    } as any;

    const result = await submitSignedXdr(signedXdr(), {
      server,
      networkPassphrase: NETWORK_PASSPHRASE,
      pollIntervalMs: 0,
    });
    expect(result.status).toBe(Api.GetTransactionStatus.FAILED);
  });

  it("throws a timeout error if the result stays NOT_FOUND past maxPolls", async () => {
    const server = {
      sendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "h" }),
      getTransaction: vi.fn().mockResolvedValue({ status: Api.GetTransactionStatus.NOT_FOUND }),
    } as any;

    await expect(
      submitSignedXdr(signedXdr(), {
        server,
        networkPassphrase: NETWORK_PASSPHRASE,
        pollIntervalMs: 0,
        maxPolls: 3,
      }),
    ).rejects.toThrow(/timed out/i);
    expect(server.getTransaction).toHaveBeenCalledTimes(3);
  });
});
