import { z } from "zod";
import { networkSchema } from "../enums";

/** POST /defindex/vault/:address/deposit-xdr */
export const buildVaultDepositXdrSchema = z.object({
  /** Stellar address depositing into the vault (the multisig account itself). */
  caller: z.string().min(1),
  /** Decimal amount as a string (e.g. "10.5"), converted to stroops server-side. */
  amount: z.string().min(1),
  /** Network the vault lives on. Defaults to the API's STELLAR_NETWORK. */
  network: networkSchema.optional(),
});
export type BuildVaultDepositXdrDto = z.infer<
  typeof buildVaultDepositXdrSchema
>;

export type BuildVaultDepositXdrResponse = {
  xdr: string;
};

/** POST /defindex/vault/:address/withdraw-xdr */
export const buildVaultWithdrawXdrSchema = z.object({
  /** Stellar address withdrawing from the vault (the multisig account itself). */
  caller: z.string().min(1),
  /** Decimal amount of the underlying asset as a string, e.g. "10.5". */
  amount: z.string().min(1),
  /** Network the vault lives on. Defaults to the API's STELLAR_NETWORK. */
  network: networkSchema.optional(),
});
export type BuildVaultWithdrawXdrDto = z.infer<
  typeof buildVaultWithdrawXdrSchema
>;

export type BuildVaultWithdrawXdrResponse = {
  xdr: string;
};

/** GET /defindex/vault/:address/balance?from=...&network=... */
export const getVaultBalanceQuerySchema = z.object({
  /** Stellar address holding (or not yet holding) vault shares. */
  from: z.string().min(1),
  /** Network the vault lives on. Defaults to the API's STELLAR_NETWORK. */
  network: networkSchema.optional(),
});
export type GetVaultBalanceQueryDto = z.infer<
  typeof getVaultBalanceQuerySchema
>;

/** Raw stroop amounts as strings, one entry per underlying asset. */
export type VaultBalanceResponse = {
  dfTokens: string;
  underlyingBalance: string[];
};
