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

/** Read shape: server-assigned id. */
export const accountMemberSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  publicKey: z.string().min(1),
  weight: z.number().int().nonnegative(),
  role: memberRoleSchema,
});
export type AccountMember = z.infer<typeof accountMemberSchema>;
