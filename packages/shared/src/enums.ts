import { z } from "zod";

/** Transaction category. Extensible: add new members as builders are added. */
export const transactionTypeSchema = z.enum([
  "payment",
  "config",
  "trade",
  "trustline",
  "vault_deposit",
  "vault_withdraw",
]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/**
 * Stellar network a transaction targets. Cluster operates on mainnet by
 * default (real funds); "testnet" is an explicit opt-in used today only by
 * `vault_deposit` transactions against DeFindex's testnet vaults.
 */
export const networkSchema = z.enum(["mainnet", "testnet"]);
export type Network = z.infer<typeof networkSchema>;

/** Lifecycle status of a pending multisig transaction. */
export const transactionStatusSchema = z.enum([
  "pending",
  "ready",
  "submitted",
  "failed",
]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

/** Stellar threshold category an operation requires. */
export const thresholdLevelSchema = z.enum(["low", "medium", "high"]);
export type ThresholdLevel = z.infer<typeof thresholdLevelSchema>;

/** Role of a member within a multisig account. */
export const memberRoleSchema = z.enum(["owner", "admin", "member"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;
