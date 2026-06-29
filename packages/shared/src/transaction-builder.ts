import { z } from "zod";
import { transactionTypeSchema, thresholdLevelSchema } from "./enums";

/**
 * The output of any TransactionBuilder. The builder returns the threshold
 * **category** (Stellar's low/medium/high classification); the pipeline
 * resolves the numeric requirement via account.thresholds[level].
 */
export const builtTransactionSchema = z.object({
  xdr: z.string(),
  type: transactionTypeSchema,
  thresholdLevel: thresholdLevelSchema,
});
export type BuiltTransaction = z.infer<typeof builtTransactionSchema>;

/**
 * Contract every per-type builder (payment/config/trade — owned by M2/M3/M4)
 * implements. `input` is builder-specific; the output is the frozen
 * BuiltTransaction shape.
 */
export interface TransactionBuilder<TInput = unknown> {
  build(input: TInput): Promise<BuiltTransaction>;
}
