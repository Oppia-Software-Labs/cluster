import { z } from "zod";
import {
  transactionTypeSchema,
  thresholdLevelSchema,
  transactionStatusSchema,
} from "../enums";

/** POST /accounts/:id/transactions */
export const proposeTransactionSchema = z.object({
  type: transactionTypeSchema,
  xdr: z.string().min(1),
  thresholdLevel: thresholdLevelSchema,
  memo: z.string().optional(),
});
export type ProposeTransactionDto = z.infer<typeof proposeTransactionSchema>;

/** POST /transactions/:id/signatures */
export const addSignatureSchema = z.object({
  signerPublicKey: z.string().min(1),
  signatureXdr: z.string().min(1),
});
export type AddSignatureDto = z.infer<typeof addSignatureSchema>;

/** POST /transactions/:id/submit (empty body) */
export const submitTransactionSchema = z.object({});
export type SubmitTransactionDto = z.infer<typeof submitTransactionSchema>;

/** Response of POST /transactions/:id/submit */
export const submitTransactionResponseSchema = z.object({
  hash: z.string(),
  status: transactionStatusSchema,
});
export type SubmitTransactionResponse = z.infer<
  typeof submitTransactionResponseSchema
>;
