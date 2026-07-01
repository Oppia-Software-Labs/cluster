import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateMultisigAccountRequest,
  MultisigAccount,
  MultisigAccountWithMembers,
} from "@cluster/shared";
import { http } from "./http";

export type Health = {
  status: string;
  message: string;
};

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data } = await http.get<Health>("/health");
      return data;
    },
  });
}

/** Accounts the signed-in user is a member of. */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await http.get<MultisigAccount[]>("/accounts");
      return data;
    },
  });
}

/** A single account with its members. Disabled until an id is available. */
export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["accounts", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await http.get<MultisigAccountWithMembers>(
        `/accounts/${id}`,
      );
      return data;
    },
  });
}

/**
 * Persist a multisig account after its on-chain bootstrap has been submitted.
 * The caller owns the chain side (see lib/accounts/create-multisig); this only
 * records it in the API. Invalidates the accounts list on success.
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMultisigAccountRequest) => {
      const { data } = await http.post<MultisigAccountWithMembers>(
        "/accounts",
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
