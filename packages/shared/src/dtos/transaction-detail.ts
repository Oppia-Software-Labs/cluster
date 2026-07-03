import { z } from "zod";
import { transactionSchema } from "./transaction";
import { signatureSchema } from "./signature";

/** GET /transactions/:id — transaction with accumulated signatures. */
export const transactionWithSignaturesSchema = transactionSchema.extend({
  signatures: z.array(signatureSchema),
});
export type TransactionWithSignatures = z.infer<
  typeof transactionWithSignaturesSchema
>;
