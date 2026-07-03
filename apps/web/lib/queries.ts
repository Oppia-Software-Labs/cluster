import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountThresholds,
  AddAccountMemberRequest,
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

/** Refresh both the account list and the single-account detail after a change. */
function useAccountInvalidator(accountId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };
}

/** Add a signer to an account (owner/admin only). */
export function useAddMember(accountId: string) {
  const invalidate = useAccountInvalidator(accountId);
  return useMutation({
    mutationFn: async (body: AddAccountMemberRequest) => {
      const { data } = await http.post<MultisigAccountWithMembers>(
        `/accounts/${accountId}/members`,
        body,
      );
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Remove a signer from an account (owner/admin only). */
export function useRemoveMember(accountId: string) {
  const invalidate = useAccountInvalidator(accountId);
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data } = await http.delete<MultisigAccountWithMembers>(
        `/accounts/${accountId}/members/${memberId}`,
      );
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Update the low/medium/high signing thresholds (owner/admin only). */
export function useUpdateThresholds(accountId: string) {
  const invalidate = useAccountInvalidator(accountId);
  return useMutation({
    mutationFn: async (body: AccountThresholds) => {
      const { data } = await http.patch<MultisigAccountWithMembers>(
        `/accounts/${accountId}/thresholds`,
        body,
      );
      return data;
    },
    onSuccess: invalidate,
  });
}
