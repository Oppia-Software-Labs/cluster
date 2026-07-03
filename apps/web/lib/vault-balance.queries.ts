import { useQueries, useQuery } from "@tanstack/react-query";
import type { VaultBalanceResponse } from "@cluster/shared";
import type { Vault } from "@/lib/vaults";
import { http } from "@/lib/http";

async function fetchVaultBalance(
  vaultAddress: string,
  from: string,
  network: "testnet" | "mainnet",
): Promise<VaultBalanceResponse> {
  const { data } = await http.get<VaultBalanceResponse>(
    `/defindex/vault/${vaultAddress}/balance`,
    { params: { from, network } },
  );
  return data;
}

/** The connected account's current position (shares + underlying) in one vault. */
export function useVaultBalance(
  vaultAddress: string,
  from: string | undefined,
  network: "testnet" | "mainnet",
) {
  return useQuery({
    queryKey: ["vault-balance", vaultAddress, from, network],
    enabled: Boolean(from),
    queryFn: () => fetchVaultBalance(vaultAddress, from!, network),
  });
}

/**
 * The connected account's position across a fixed list of vaults, one query
 * per vault. Uses `useQueries` (not a hook called inside `.map`) so the list
 * can vary in length without breaking the rules of hooks.
 */
export function useVaultBalances(vaultList: Vault[], from: string | undefined) {
  return useQueries({
    queries: vaultList.map((vault) => ({
      queryKey: ["vault-balance", vault.address, from, vault.network],
      enabled: Boolean(from),
      queryFn: () => fetchVaultBalance(vault.address, from!, vault.network),
    })),
  });
}
