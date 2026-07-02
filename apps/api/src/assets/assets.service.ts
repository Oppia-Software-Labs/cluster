import { Injectable, NotFoundException } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import type {
  AccountBalancesResponse,
  AccountHistoryResponse,
  BalanceAsset,
} from '@cluster/shared';
import { PrismaService } from '../prisma/prisma.service';
import { accountWhere } from '../common/account-ref';

const BALANCE_CACHE_TTL_MS = 30_000;

/**
 * Read the mainnet Horizon endpoint from the environment. No provider is hardcoded —
 * STELLAR_HORIZON_URL is swappable without code changes (per the locked design).
 */
export function getHorizonUrl(): string {
  const url = process.env.STELLAR_HORIZON_URL;
  if (!url) {
    throw new Error(
      'STELLAR_HORIZON_URL is not set. Refusing to construct a Horizon client.',
    );
  }
  return url;
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalances(accountId: string): Promise<AccountBalancesResponse> {
    const account = await this.loadAccount(accountId);
    const cached = await this.readCachedBalances(account.id);
    if (cached) {
      return cached;
    }

    const horizon = new Horizon.Server(getHorizonUrl());
    const stellarAccount = await horizon
      .accounts()
      .accountId(account.stellarAccountId)
      .call();

    const capturedAt = new Date();
    const balances = this.parseHorizonBalances(stellarAccount.balances);

    // TODO(M3+): enumerate SAC / Soroban token balances beyond classic trustlines.
    await this.prisma.balanceSnapshot.createMany({
      data: balances.map((b) => ({
        accountId: account.id,
        assetCode: b.assetCode,
        assetIssuer: b.assetIssuer,
        amount: b.amount,
        capturedAt,
      })),
    });

    return {
      balances,
      capturedAt: capturedAt.toISOString(),
    };
  }

  async getHistory(accountId: string): Promise<AccountHistoryResponse> {
    const account = await this.loadAccount(accountId);
    const horizon = new Horizon.Server(getHorizonUrl());

    // TODO(M3+): richer cashflow aggregation (effects, trades, contract events).
    const page = await horizon
      .payments()
      .forAccount(account.stellarAccountId)
      .order('desc')
      .limit(20)
      .call();

    const records = page.records.map((record) => this.mapHistoryRecord(record));

    return { records };
  }

  private async loadAccount(accountId: string) {
    const account = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    return account;
  }

  private async readCachedBalances(
    accountId: string,
  ): Promise<AccountBalancesResponse | null> {
    const latest = await this.prisma.balanceSnapshot.findFirst({
      where: { accountId },
      orderBy: { capturedAt: 'desc' },
    });
    if (!latest) {
      return null;
    }

    const ageMs = Date.now() - latest.capturedAt.getTime();
    if (ageMs > BALANCE_CACHE_TTL_MS) {
      return null;
    }

    const snapshots = await this.prisma.balanceSnapshot.findMany({
      where: { accountId, capturedAt: latest.capturedAt },
    });

    return {
      balances: snapshots.map((s) => ({
        assetCode: s.assetCode,
        assetIssuer: s.assetIssuer,
        amount: s.amount.toString(),
      })),
      capturedAt: latest.capturedAt.toISOString(),
    };
  }

  private parseHorizonBalances(
    lines: Horizon.ServerApi.AccountRecord['balances'],
  ): BalanceAsset[] {
    const balances: BalanceAsset[] = [];
    for (const balance of lines) {
      if (balance.asset_type === 'native') {
        balances.push({
          assetCode: 'native',
          assetIssuer: null,
          amount: balance.balance,
        });
        continue;
      }
      if (balance.asset_type === 'liquidity_pool_shares') {
        // TODO(M3+): represent LP share balances explicitly.
        continue;
      }
      balances.push({
        assetCode: balance.asset_code,
        assetIssuer: balance.asset_issuer,
        amount: balance.balance,
      });
    }
    return balances;
  }

  private mapHistoryRecord(record: Horizon.ServerApi.OperationRecord) {
    const base = {
      id: record.id,
      type: record.type,
      createdAt: record.created_at,
      transactionHash: record.transaction_hash,
    };

    if (record.type === 'payment' || record.type === 'path_payment_strict_send') {
      return {
        ...base,
        amount: record.amount,
        assetCode:
          record.asset_type === 'native' ? 'native' : record.asset_code,
        assetIssuer:
          record.asset_type === 'native' ? null : record.asset_issuer,
        from: 'from' in record ? record.from : undefined,
        to: 'to' in record ? record.to : undefined,
      };
    }

    if (record.type === 'path_payment_strict_receive') {
      return {
        ...base,
        amount: record.amount,
        assetCode:
          record.asset_type === 'native' ? 'native' : record.asset_code,
        assetIssuer:
          record.asset_type === 'native' ? null : record.asset_issuer,
        from: record.from,
        to: record.to,
      };
    }

    return base;
  }
}
