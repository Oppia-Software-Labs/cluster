import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AssetsService, getHorizonUrl } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';

describe('getHorizonUrl', () => {
  const original = process.env.STELLAR_HORIZON_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STELLAR_HORIZON_URL;
    } else {
      process.env.STELLAR_HORIZON_URL = original;
    }
  });

  it('throws when STELLAR_HORIZON_URL is unset', () => {
    delete process.env.STELLAR_HORIZON_URL;
    expect(() => getHorizonUrl()).toThrow(/STELLAR_HORIZON_URL is not set/);
  });

  it('returns the configured URL', () => {
    process.env.STELLAR_HORIZON_URL = 'https://horizon.stellar.org';
    expect(getHorizonUrl()).toBe('https://horizon.stellar.org');
  });
});

describe('AssetsService.getBalances', () => {
  let service: AssetsService;
  const prismaMock = {
    multisigAccount: { findUnique: jest.fn() },
    balanceSnapshot: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(AssetsService);
  });

  it('throws when the account is missing', async () => {
    prismaMock.multisigAccount.findUnique.mockResolvedValue(null);
    await expect(service.getBalances('missing')).rejects.toThrow(NotFoundException);
  });

  it('serves cached balances when a fresh snapshot exists', async () => {
    const capturedAt = new Date();
    prismaMock.multisigAccount.findUnique.mockResolvedValue({
      id: 'acc1',
      stellarAccountId: 'GABC',
    });
    prismaMock.balanceSnapshot.findFirst.mockResolvedValue({
      capturedAt,
    });
    prismaMock.balanceSnapshot.findMany.mockResolvedValue([
      {
        assetCode: 'native',
        assetIssuer: null,
        amount: { toString: () => '100.0000000' },
      },
    ]);

    const result = await service.getBalances('acc1');

    expect(result.balances).toEqual([
      { assetCode: 'native', assetIssuer: null, amount: '100.0000000' },
    ]);
    expect(result.capturedAt).toBe(capturedAt.toISOString());
  });
});
