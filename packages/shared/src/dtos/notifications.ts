import { z } from "zod";

/**
 * One account with pending transactions the current user hasn't signed yet.
 * `stellarAccountId` (not `accountId`) is what the web app links with — see
 * apps/api/src/common/account-ref.ts: "The web app links by address so URLs
 * are meaningful."
 */
export const pendingSignatureAccountSchema = z.object({
  accountId: z.string().min(1),
  stellarAccountId: z.string().min(1),
  accountName: z.string().min(1),
  count: z.number().int().nonnegative(),
});
export type PendingSignatureAccount = z.infer<
  typeof pendingSignatureAccountSchema
>;

/** GET /transactions/pending-for-me */
export const pendingSignaturesResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  accounts: z.array(pendingSignatureAccountSchema),
});
export type PendingSignaturesResponse = z.infer<
  typeof pendingSignaturesResponseSchema
>;
