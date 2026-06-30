import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddSignatureDto,
  ProposeTransactionDto,
  Signature,
  SubmitTransactionResponse,
  Transaction,
  TransactionWithSignatures,
} from "@cluster/shared";
import { http } from "./http";

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

export function useAddSignature(transactionId: string) {
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
    },
  });
}

export function useSubmitTransaction(transactionId: string) {
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
    },
  });
}
