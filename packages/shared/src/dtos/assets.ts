import { z } from "zod";

/** A single asset balance line (native or trustline). */
export const balanceAssetSchema = z.object({
  assetCode: z.string(),
  assetIssuer: z.string().nullable(),
  amount: z.string(),
});
export type BalanceAsset = z.infer<typeof balanceAssetSchema>;

/** GET /accounts/:id/balances */
export const accountBalancesResponseSchema = z.object({
  balances: z.array(balanceAssetSchema),
  capturedAt: z.string().datetime(),
});
export type AccountBalancesResponse = z.infer<
  typeof accountBalancesResponseSchema
>;

/** A single Horizon payment/operation record (minimal scaffold). */
export const historyRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string(),
  amount: z.string().optional(),
  assetCode: z.string().optional(),
  assetIssuer: z.string().nullable().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  transactionHash: z.string().optional(),
});
export type HistoryRecord = z.infer<typeof historyRecordSchema>;

/** GET /accounts/:id/history */
export const accountHistoryResponseSchema = z.object({
  records: z.array(historyRecordSchema),
});
export type AccountHistoryResponse = z.infer<
  typeof accountHistoryResponseSchema
>;
