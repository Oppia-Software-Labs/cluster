import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddSignatureDto,
  PendingSignaturesResponse,
  ProposeTransactionDto,
  Signature,
  SubmitTransactionResponse,
  Transaction,
  TransactionWithSignatures,
} from "@cluster/shared";
import { passphraseFor } from "./stellar-network";
import { http } from "./http";
import { signWithWallet } from "./transactions/sign";

/**
 * Pending transactions, across every account the signed-in user belongs to,
 * that are still missing their signature — backs the notifications bell's
 * badge. Polled rather than invalidated-only, since a co-signer proposing a
 * new transaction is something this user's own actions can't trigger a
 * refetch for.
 */
export function usePendingSignatures() {
  return useQuery({
    queryKey: ["pending-signatures"],
    queryFn: async () => {
      const { data } = await http.get<PendingSignaturesResponse>(
        "/transactions/pending-for-me",
      );
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useAccountTransactions(accountId: string) {
  return useQuery({
    queryKey: ["transactions", accountId],
    queryFn: async () => {
      const { data } = await http.get<Transaction[]>(
        `/accounts/${accountId}/transactions`,
      );
      return data;
    },
    enabled: Boolean(accountId),
  });
}

export function useTransaction(transactionId: string) {
  return useQuery({
    queryKey: ["transaction", transactionId],
    queryFn: async () => {
      const { data } = await http.get<TransactionWithSignatures>(
        `/transactions/${transactionId}`,
      );
      return data;
    },
    enabled: Boolean(transactionId),
  });
}

export function useProposeTransaction(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ProposeTransactionDto) => {
      const { data } = await http.post<Transaction>(
        `/accounts/${accountId}/transactions`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
    },
  });
}

export type ProposeAndSignResult = {
  tx: Transaction;
  /** False when the wallet declined to sign — the proposal still stands. */
  signed: boolean;
};

/**
 * Propose a transaction and immediately collect the proposer's own signature —
 * they are a signer on the account, so proposing without signing would just
 * force a second trip to the Activity page. If the wallet prompt is rejected,
 * the proposal is kept and `signed: false` is returned so callers can say so.
 */
export function useProposeAndSign(accountId: string, signerPublicKey?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      dto: ProposeTransactionDto,
    ): Promise<ProposeAndSignResult> => {
      const { data: tx } = await http.post<Transaction>(
        `/accounts/${accountId}/transactions`,
        dto,
      );
      if (!signerPublicKey) return { tx, signed: false };
      try {
        const signatureXdr = await signWithWallet(
          dto.xdr,
          signerPublicKey,
          passphraseFor(dto.network),
        );
        await http.post<Signature>(`/transactions/${tx.id}/signatures`, {
          signerPublicKey,
          signatureXdr,
        });
        return { tx, signed: true };
      } catch {
        return { tx, signed: false };
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
      queryClient.invalidateQueries({ queryKey: ["pending-signatures"] });
    },
  });
}

/**
 * Signing can flip the transaction's status (pending → ready) and submitting
 * always does, so both mutations refresh the per-transaction detail AND the
 * account's transaction list when `accountId` is known.
 */
export function useAddSignature(transactionId: string, accountId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AddSignatureDto) => {
      const { data } = await http.post<Signature>(
        `/transactions/${transactionId}/signatures`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", transactionId] });
      queryClient.invalidateQueries({ queryKey: ["pending-signatures"] });
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
      }
    },
  });
}

export function useSubmitTransaction(transactionId: string, accountId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await http.post<SubmitTransactionResponse>(
        `/transactions/${transactionId}/submit`,
        {},
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", transactionId] });
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
        // Submitting a config transaction applies its deferred roster/threshold
        // change server-side, so the account detail must refresh too.
        queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }
    },
  });
}
