import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BuildVaultDepositXdrDto,
  BuildVaultWithdrawXdrDto,
  GetVaultBalanceQueryDto,
  VaultBalanceResponse,
} from '@cluster/shared';
import { getStellarNetwork } from '@cluster/stellar';
import type { Env } from '../config/env.schema';

const DEFINDEX_API_URL = 'https://api.defindex.io';
/** DeFindex Soroban token contracts use 7 decimals, same as Stellar's native XLM. */
const STROOP_DECIMALS = 7;

@Injectable()
export class DefindexService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Ask DeFindex to build an unsigned deposit transaction for an existing
   * vault on the requested network (default: the active STELLAR_NETWORK).
   * The API key stays server-side; the caller only gets back the XDR to
   * carry through Cluster's own sign/submit pipeline.
   */
  async buildDepositXdr(
    vaultAddress: string,
    dto: BuildVaultDepositXdrDto,
  ): Promise<{ xdr: string }> {
    const amountStroops = toStroops(dto.amount);
    const network = dto.network ?? getStellarNetwork();

    const res = await fetch(
      `${DEFINDEX_API_URL}/vault/${vaultAddress}/deposit?network=${network}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('DEFINDEX_API_KEY', { infer: true })}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amounts: [amountStroops],
          caller: dto.caller,
          invest: true,
          slippageBps: 50,
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `DeFindex deposit request failed (${res.status}): ${detail || res.statusText}`,
      );
    }

    const data = (await res.json()) as { xdr?: string };
    if (!data.xdr) {
      throw new BadRequestException('DeFindex did not return a transaction XDR.');
    }
    return { xdr: data.xdr };
  }

  /**
   * Ask DeFindex to build an unsigned withdrawal transaction for an existing
   * vault on the requested network (burns vault shares for the underlying
   * asset).
   */
  async buildWithdrawXdr(
    vaultAddress: string,
    dto: BuildVaultWithdrawXdrDto,
  ): Promise<{ xdr: string }> {
    const amountStroops = toStroops(dto.amount);
    const network = dto.network ?? getStellarNetwork();

    const res = await fetch(
      `${DEFINDEX_API_URL}/vault/${vaultAddress}/withdraw?network=${network}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('DEFINDEX_API_KEY', { infer: true })}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amounts: [amountStroops],
          caller: dto.caller,
          slippageBps: 50,
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `DeFindex withdraw request failed (${res.status}): ${detail || res.statusText}`,
      );
    }

    const data = (await res.json()) as { xdr?: string };
    if (!data.xdr) {
      throw new BadRequestException('DeFindex did not return a transaction XDR.');
    }
    return { xdr: data.xdr };
  }

  /**
   * Read-only: the caller's current shares/underlying balance in a vault.
   * No signing involved — just a DeFindex GET proxied through the server so
   * the API key never reaches the browser.
   */
  async getBalance(
    vaultAddress: string,
    query: GetVaultBalanceQueryDto,
  ): Promise<VaultBalanceResponse> {
    const network = query.network ?? getStellarNetwork();
    const params = new URLSearchParams({ from: query.from, network });

    const res = await fetch(
      `${DEFINDEX_API_URL}/vault/${vaultAddress}/balance?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.get('DEFINDEX_API_KEY', { infer: true })}`,
        },
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `DeFindex balance request failed (${res.status}): ${detail || res.statusText}`,
      );
    }

    return (await res.json()) as VaultBalanceResponse;
  }
}

/** Convert a decimal amount string (e.g. "10.5") to an integer stroop amount. */
function toStroops(amount: string): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException('amount must be a positive number');
  }
  return Math.round(value * 10 ** STROOP_DECIMALS);
}
