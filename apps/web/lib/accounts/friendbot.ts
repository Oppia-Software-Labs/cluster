import { getRpcServer } from "@cluster/stellar";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;

/**
 * Fund a testnet address with Stellar's Friendbot faucet (10,000 XLM, fixed
 * by Friendbot — not configurable). Uses the SDK's `Server.fundAddress`,
 * which discovers the network's Friendbot URL itself rather than hardcoding
 * friendbot.stellar.org — see https://developers.stellar.org/docs/networks#friendbot.
 */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  if (!RPC_URL) {
    throw new Error(
      "NEXT_PUBLIC_STELLAR_RPC_URL is not configured; cannot reach Stellar RPC.",
    );
  }
  await getRpcServer(RPC_URL).fundAddress(publicKey);
}
