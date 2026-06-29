import { z } from "zod";
import {
  transactionTypeSchema,
  transactionStatusSchema,
  thresholdLevelSchema,
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
 * submittedHash (null until submitted).
 */
export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  type: transactionTypeSchema,
  xdr: z.string().min(1),
  status: transactionStatusSchema,
  requiredThreshold: z.number().int().nonnegative(),
  proposedBy: z.string().min(1),
  submittedHash: z.string().nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;
