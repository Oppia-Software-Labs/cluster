import { z } from "zod";

/** POST /defindex/vault/:address/deposit-xdr */
export const buildVaultDepositXdrSchema = z.object({
  /** Stellar address depositing into the vault (the multisig account itself). */
  caller: z.string().min(1),
  /** Decimal amount as a string (e.g. "10.5"), converted to stroops server-side. */
  amount: z.string().min(1),
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
});
export type BuildVaultWithdrawXdrDto = z.infer<
  typeof buildVaultWithdrawXdrSchema
>;

export type BuildVaultWithdrawXdrResponse = {
  xdr: string;
};
