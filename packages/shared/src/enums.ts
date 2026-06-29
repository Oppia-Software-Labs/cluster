import { z } from "zod";

/** Transaction category. Extensible: add new members as builders are added. */
export const transactionTypeSchema = z.enum(["payment", "config", "trade"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

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
