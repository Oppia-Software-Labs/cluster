import { z } from "zod";

/** low/medium/high numeric thresholds (Stellar weights). */
export const accountThresholdsSchema = z.object({
  low: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
});
export type AccountThresholds = z.infer<typeof accountThresholdsSchema>;

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
