"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type {
  AdvanceRegistrationDto,
  ConfidentialRegistrationDto,
  KeyEnvelopeDto,
  KeyEnvelopeResponse,
  RegistrationResponse,
  WrapKeyDto,
  WrapKeyResponse,
} from "@cluster/shared";
import { http } from "@/lib/http";

/** Return `null` when the API responds 404 — resource simply doesn't exist yet. */
async function getOrNull<T>(url: string): Promise<T | null> {
  try {
    const { data } = await http.get<T>(url);
    return data;
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 404) return null;
    throw e;
  }
}

/**
 * Fetch the persisted confidential-token registration record for an account,
 * or `null` when the account has not started registration yet (404).
 */
export function useConfidentialRegistration(accountId?: string) {
  return useQuery({
    queryKey: ["confidential-registration", accountId],
    queryFn: () =>
      getOrNull<RegistrationResponse>(
        `/confidential/accounts/${accountId}/registration`,
      ),
    enabled: Boolean(accountId),
  });
}

/**
 * Create a new confidential registration row for an account (activation step 1).
 * Invalidates the registration query so downstream wizards see the fresh status.
 */
export function useCreateRegistration(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ConfidentialRegistrationDto) => {
      const { data } = await http.post<RegistrationResponse>(
        `/confidential/accounts/${accountId}/registration`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["confidential-registration", accountId],
      });
    },
  });
}

/**
 * Advance registration status after the on-chain register event is observed
 * (e.g. `pending` → `registered`).
 */
export function useAdvanceRegistration(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AdvanceRegistrationDto) => {
      const { data } = await http.patch<RegistrationResponse>(
        `/confidential/accounts/${accountId}/registration`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["confidential-registration", accountId],
      });
    },
  });
}

/**
 * Fetch the signed-in member's published wrap public key, or `null` when they
 * have not published one yet (404).
 */
export function useWrapKey(userPublicKey?: string) {
  return useQuery({
    queryKey: ["confidential-wrap-key", userPublicKey],
    queryFn: () =>
      getOrNull<WrapKeyResponse>(`/confidential/wrap-key/${userPublicKey}`),
    enabled: Boolean(userPublicKey),
  });
}

/**
 * Publish (upsert) the member's wrap public key derived from their wallet
 * message signature. Invalidates all wrap-key queries so grant-access flows
 * see the fresh key material.
 */
export function usePublishWrapKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: WrapKeyDto) => {
      const { data } = await http.put<WrapKeyResponse>(
        "/confidential/wrap-key",
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["confidential-wrap-key"] });
    },
  });
}

/**
 * List every member's sealed key envelope for an account. Ciphertext is opaque
 * to the server; only the holder of the matching wrap secret can unseal.
 */
export function useKeyEnvelopes(accountId?: string) {
  return useQuery({
    queryKey: ["confidential-envelopes", accountId],
    queryFn: async () => {
      const { data } = await http.get<KeyEnvelopeResponse[]>(
        `/confidential/accounts/${accountId}/envelopes`,
      );
      return data;
    },
    enabled: Boolean(accountId),
  });
}

/**
 * Upsert one member's sealed envelope for an account (activation / grant-access).
 * Invalidates the envelopes list for that account.
 */
export function usePutKeyEnvelope(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: KeyEnvelopeDto) => {
      const { data } = await http.put<KeyEnvelopeResponse>(
        `/confidential/accounts/${accountId}/envelopes`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["confidential-envelopes", accountId],
      });
    },
  });
}
