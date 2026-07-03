import { z } from "zod";
import {
  transactionTypeSchema,
  transactionStatusSchema,
  thresholdLevelSchema,
  networkSchema,
  confidentialOpSchema,
} from "../enums";

/**
 * Input to propose a transaction. Mirrors ProposeTransactionDto but is
 * scoped to a parent account (accountId comes from the route in the API).
 */
export const createTransactionSchema = z.object({
  accountId: z.string().min(1),
  type: transactionTypeSchema,
  xdr: z.string().min(1),
  thresholdLevel: thresholdLevelSchema,
  memo: z.string().optional(),
});
export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

/**
 * Read shape: status + resolved numeric requiredThreshold + optional
 * submittedHash (null until submitted). `memo` surfaces the human-readable
 * intent (e.g. "Add signer GABC…XYZW") in transaction lists.
 */
export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  type: transactionTypeSchema,
  xdr: z.string().min(1),
  status: transactionStatusSchema,
  requiredThreshold: z.number().int().nonnegative(),
  proposedBy: z.string().min(1),
  memo: z.string().nullable(),
  network: networkSchema,
  submittedHash: z.string().nullable(),
  /** Decoded reason for the last on-chain failure; null unless status=failed. */
  lastError: z.string().nullable(),
  /**
   * The confidential-token operation this transaction performs, when
   * type=confidential; null/absent otherwise. Lets the UI label the op.
   */
  confidentialOp: confidentialOpSchema.nullish(),
  confidentialPayload: z.string().nullish(),
});
export type Transaction = z.infer<typeof transactionSchema>;
