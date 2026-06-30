import { useQuery } from "@tanstack/react-query";
import type {
  AccountBalancesResponse,
  AccountHistoryResponse,
} from "@cluster/shared";
import { http } from "./http";

export function useBalances(accountId: string) {
  return useQuery({
    queryKey: ["balances", accountId],
    queryFn: async () => {
      const { data } = await http.get<AccountBalancesResponse>(
        `/accounts/${accountId}/balances`,
      );
      return data;
    },
    enabled: Boolean(accountId),
  });
}

export function useHistory(accountId: string) {
  return useQuery({
    queryKey: ["history", accountId],
    queryFn: async () => {
      const { data } = await http.get<AccountHistoryResponse>(
        `/accounts/${accountId}/history`,
      );
      return data;
    },
    enabled: Boolean(accountId),
  });
}
