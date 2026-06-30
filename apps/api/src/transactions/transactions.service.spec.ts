jest.mock('@cluster/stellar', () => {
  const actual = jest.requireActual('@cluster/stellar');
  return {
    ...actual,
    submitSignedXdr: jest.fn((...args: unknown[]) => actual.submitSignedXdr(...args)),
  };
});

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, submitSignedXdr } from '@cluster/stellar';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

const signerA = Keypair.random();
const signerB = Keypair.random();

function buildUnsignedXdr(): string {
  const source = new Account(signerA.publicKey(), '1234567890');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: signerB.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    )
    .setTimeout(0)
    .build();
  return tx.toXDR();
}

function signatureFor(xdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  return signer.sign(tx.hash()).toString('base64');
}

describe('TransactionsService.resolveRequiredThreshold', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  const account = { low: 1, medium: 2, high: 3 };

  it('maps low to account.low', () => {
    expect(service.resolveRequiredThreshold(account, 'low')).toBe(1);
  });

  it('maps medium to account.medium', () => {
    expect(service.resolveRequiredThreshold(account, 'medium')).toBe(2);
  });

  it('maps high to account.high', () => {
    expect(service.resolveRequiredThreshold(account, 'high')).toBe(3);
  });
});

describe('TransactionsService.addSignature', () => {
  let service: TransactionsService;
  const prismaMock = {
    transaction: { findUnique: jest.fn(), update: jest.fn() },
    accountMember: { findUnique: jest.fn(), findMany: jest.fn() },
    signature: { upsert: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  it('rejects signers who are not account members', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      accountId: 'acc1',
      status: 'pending',
      requiredThreshold: 2,
    });
    prismaMock.accountMember.findUnique.mockResolvedValue(null);

    await expect(
      service.addSignature('tx1', {
        signerPublicKey: signerA.publicKey(),
        signatureXdr: 'AAAA',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('flips status pending→ready when threshold is met', async () => {
    const xdr = buildUnsignedXdr();
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      accountId: 'acc1',
      status: 'pending',
      requiredThreshold: 2,
    });
    prismaMock.accountMember.findUnique.mockResolvedValue({
      publicKey: signerA.publicKey(),
      weight: 2,
    });
    prismaMock.signature.upsert.mockResolvedValue({
      id: 'sig1',
      transactionId: 'tx1',
      signerPublicKey: signerA.publicKey(),
      signatureXdr: signatureFor(xdr, signerA),
      weight: 2,
    });
    prismaMock.signature.findMany.mockResolvedValue([
      {
        signerPublicKey: signerA.publicKey(),
        signatureXdr: signatureFor(xdr, signerA),
      },
    ]);
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 2 },
      { publicKey: signerB.publicKey(), weight: 1 },
    ]);
    prismaMock.transaction.update.mockResolvedValue({});

    await service.addSignature('tx1', {
      signerPublicKey: signerA.publicKey(),
      signatureXdr: signatureFor(xdr, signerA),
    });

    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: 'ready' },
    });
  });
});

describe('TransactionsService.submit', () => {
  let service: TransactionsService;
  const prismaMock = {
    transaction: { findUnique: jest.fn(), update: jest.fn() },
    accountMember: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  it('refuses submit when threshold is not met', async () => {
    const xdr = buildUnsignedXdr();
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      accountId: 'acc1',
      status: 'pending',
      requiredThreshold: 5,
      xdr,
      signatures: [
        {
          signerPublicKey: signerA.publicKey(),
          signatureXdr: signatureFor(xdr, signerA),
        },
      ],
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 1 },
    ]);

    await expect(service.submit('tx1')).rejects.toThrow(BadRequestException);
    await expect(service.submit('tx1')).rejects.toThrow(/threshold not met/);
  });

  it('submits successfully with a mocked RPC server', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      accountId: 'acc1',
      status: 'ready',
      requiredThreshold: 1,
      xdr,
      signatures: [{ signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr }],
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 1 },
    ]);
    prismaMock.transaction.update.mockResolvedValue({});

    const getTransaction = jest
      .fn()
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });
    const server = {
      sendTransaction: jest.fn().mockResolvedValue({ status: 'PENDING', hash: 'abc123' }),
      getTransaction,
    } as any;

    const actualStellar = jest.requireActual('@cluster/stellar');
    (submitSignedXdr as jest.Mock).mockImplementationOnce(
      (signedXdr: string, options: Record<string, unknown>) =>
        actualStellar.submitSignedXdr(signedXdr, {
          ...options,
          server,
          pollIntervalMs: 0,
          maxPolls: 5,
        }),
    );

    const result = await service.submit('tx1');

    expect(result).toEqual({ hash: 'abc123', status: 'submitted' });
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: 'submitted', submittedHash: 'abc123' },
    });
  });
});
