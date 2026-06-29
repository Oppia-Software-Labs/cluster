import { z } from "zod";

/** Input to attach a signature to a transaction. */
export const createSignatureSchema = z.object({
  transactionId: z.string().min(1),
  signerPublicKey: z.string().min(1),
  signatureXdr: z.string().min(1),
  weight: z.number().int().nonnegative(),
});
export type CreateSignatureDto = z.infer<typeof createSignatureSchema>;

/** Read shape: server-assigned id. */
export const signatureSchema = z.object({
  id: z.string().min(1),
  transactionId: z.string().min(1),
  signerPublicKey: z.string().min(1),
  signatureXdr: z.string().min(1),
  weight: z.number().int().nonnegative(),
});
export type Signature = z.infer<typeof signatureSchema>;
