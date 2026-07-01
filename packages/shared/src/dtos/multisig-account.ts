import { z } from "zod";
import { memberRoleSchema } from "../enums";
import { accountMemberSchema } from "./account-member";

/** low/medium/high numeric thresholds (Stellar weights). */
export const accountThresholdsSchema = z.object({
  low: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
});
export type AccountThresholds = z.infer<typeof accountThresholdsSchema>;

/** Request body for PATCH /accounts/:id/thresholds. */
export const updateAccountThresholdsRequestSchema = accountThresholdsSchema;
export type UpdateAccountThresholdsRequest = AccountThresholds;

/** Input to create a multisig account. network is server-fixed to mainnet. */
export const createMultisigAccountSchema = z.object({
  name: z.string().min(1),
  stellarAccountId: z.string().min(1),
  createdBy: z.string().min(1),
  thresholds: accountThresholdsSchema,
});
export type CreateMultisigAccountDto = z.infer<
  typeof createMultisigAccountSchema
>;

/** Read shape: server-assigned id + network. */
export const multisigAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stellarAccountId: z.string().min(1),
  network: z.literal("mainnet"),
  createdBy: z.string().min(1),
  thresholds: accountThresholdsSchema,
});
export type MultisigAccount = z.infer<typeof multisigAccountSchema>;

/**
 * A member entry as supplied when *creating* an account, before the account
 * (and therefore its server-assigned ids) exists. weight must be positive: a
 * zero-weight signer is meaningless at creation time.
 */
export const newAccountMemberSchema = z.object({
  publicKey: z.string().min(1),
  weight: z.number().int().positive(),
  role: memberRoleSchema,
});
export type NewAccountMember = z.infer<typeof newAccountMemberSchema>;

/**
 * Request body for POST /accounts. `createdBy` is intentionally absent — the
 * API derives the creator from the authenticated session, never the body.
 * `stellarAccountId` is the public key of the freshly created (and now
 * member-controlled) Stellar account, produced by the create-account flow.
 */
export const createMultisigAccountRequestSchema = z.object({
  name: z.string().min(1),
  stellarAccountId: z.string().min(1),
  thresholds: accountThresholdsSchema,
  members: z.array(newAccountMemberSchema).min(1),
});
export type CreateMultisigAccountRequest = z.infer<
  typeof createMultisigAccountRequestSchema
>;

/** Read shape for a single account including its resolved members. */
export const multisigAccountWithMembersSchema = multisigAccountSchema.extend({
  members: z.array(accountMemberSchema),
});
export type MultisigAccountWithMembers = z.infer<
  typeof multisigAccountWithMembersSchema
>;
