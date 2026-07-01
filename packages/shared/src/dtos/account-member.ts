import { z } from "zod";
import { memberRoleSchema } from "../enums";

/** Input to add a member to an account. */
export const createAccountMemberSchema = z.object({
  accountId: z.string().min(1),
  publicKey: z.string().min(1),
  weight: z.number().int().nonnegative(),
  role: memberRoleSchema,
});
export type CreateAccountMemberDto = z.infer<
  typeof createAccountMemberSchema
>;

/**
 * Request body for POST /accounts/:id/members. `accountId` comes from the
 * route, so it is intentionally absent here. weight must be positive: a
 * zero-weight signer cannot contribute to any threshold.
 */
export const addAccountMemberRequestSchema = z.object({
  publicKey: z.string().min(1),
  weight: z.number().int().positive(),
  role: memberRoleSchema,
});
export type AddAccountMemberRequest = z.infer<
  typeof addAccountMemberRequestSchema
>;

/** Read shape: server-assigned id. */
export const accountMemberSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  publicKey: z.string().min(1),
  weight: z.number().int().nonnegative(),
  role: memberRoleSchema,
});
export type AccountMember = z.infer<typeof accountMemberSchema>;
