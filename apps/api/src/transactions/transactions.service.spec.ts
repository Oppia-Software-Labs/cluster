jest.mock('@cluster/stellar', () => {
  const actual = jest.requireActual('@cluster/stellar');
  return {
    ...actual,
    submitSignedXdr: jest.fn((...args: unknown[]) => actual.submitSignedXdr(...args)),
  };
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { MAINNET_NETWORK_PASSPHRASE as NETWORK_PASSPHRASE, submitSignedXdr } from '@cluster/stellar';
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
  const txDbMock = {
    transaction: { update: jest.fn() },
    user: { upsert: jest.fn() },
    accountMember: { upsert: jest.fn(), deleteMany: jest.fn() },
    multisigAccount: { update: jest.fn() },
    activityLog: { create: jest.fn() },
  };
  const prismaMock = {
    transaction: { findUnique: jest.fn(), update: jest.fn() },
    accountMember: { findUnique: jest.fn(), findMany: jest.fn() },
    signature: { upsert: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(
      async (fn: (db: typeof txDbMock) => Promise<unknown>) => fn(txDbMock),
    ),
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
      account: { network: 'mainnet' },
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

  it('marks ready and auto-submits when the threshold is met', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    const baseTx = {
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'pending',
      requiredThreshold: 2,
      xdr,
      proposedBy: signerA.publicKey(),
      pendingChange: null,
    };
    // First lookup: the addSignature guard. Second: settleThreshold reloads
    // the transaction with its (now complete) signature set.
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(baseTx)
      .mockResolvedValueOnce({
        ...baseTx,
        signatures: [
          { signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr },
        ],
      });
    prismaMock.accountMember.findUnique.mockResolvedValue({
      publicKey: signerA.publicKey(),
      weight: 2,
    });
    prismaMock.signature.upsert.mockResolvedValue({
      id: 'sig1',
      transactionId: 'tx1',
      signerPublicKey: signerA.publicKey(),
      signatureXdr: sigXdr,
      weight: 2,
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 2 },
      { publicKey: signerB.publicKey(), weight: 1 },
    ]);
    prismaMock.transaction.update.mockResolvedValue({});

    const getTransaction = jest
      .fn()
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });
    const server = {
      sendTransaction: jest
        .fn()
        .mockResolvedValue({ status: 'PENDING', hash: 'auto123' }),
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

    await service.addSignature('tx1', {
      signerPublicKey: signerA.publicKey(),
      signatureXdr: sigXdr,
    });

    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: 'ready' },
    });
    // …and the submission happened without a separate submit call.
    expect(txDbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: 'submitted', submittedHash: 'auto123', lastError: null },
    });
  });

  it('keeps the signature even when auto-submission fails', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    const baseTx = {
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'pending',
      requiredThreshold: 2,
      xdr,
      proposedBy: signerA.publicKey(),
      pendingChange: null,
    };
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(baseTx)
      .mockResolvedValueOnce({
        ...baseTx,
        signatures: [
          { signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr },
        ],
      });
    prismaMock.accountMember.findUnique.mockResolvedValue({
      publicKey: signerA.publicKey(),
      weight: 2,
    });
    prismaMock.signature.upsert.mockResolvedValue({
      id: 'sig1',
      transactionId: 'tx1',
      signerPublicKey: signerA.publicKey(),
      signatureXdr: sigXdr,
      weight: 2,
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 2 },
    ]);
    prismaMock.transaction.update.mockResolvedValue({});

    (submitSignedXdr as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('sendTransaction returned ERROR for x (txBadSeq)')),
    );

    const sig = await service.addSignature('tx1', {
      signerPublicKey: signerA.publicKey(),
      signatureXdr: sigXdr,
    });

    expect(sig.id).toBe('sig1');
    // Failure is recorded on the row with a readable reason.
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: {
        status: 'failed',
        lastError: expect.stringContaining('txBadSeq'),
      },
    });
  });
});

describe('TransactionsService.propose (pendingChange guards)', () => {
  let service: TransactionsService;
  const prismaMock = {
    multisigAccount: { findUnique: jest.fn() },
    transaction: { create: jest.fn() },
  };

  const account = {
    id: 'acc1',
    network: 'mainnet',
    low: 1,
    medium: 2,
    high: 3,
    members: [
      { publicKey: signerA.publicKey(), weight: 2, role: 'owner' },
      { publicKey: signerB.publicKey(), weight: 1, role: 'member' },
    ],
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
    prismaMock.multisigAccount.findUnique.mockResolvedValue(account);
  });

  const baseDto = {
    type: 'config' as const,
    xdr: 'AAAA',
    thresholdLevel: 'high' as const,
  };

  it('rejects pendingChange proposals from non-admin members', async () => {
    await expect(
      service.propose(
        'acc1',
        {
          ...baseDto,
          pendingChange: {
            kind: 'member.add',
            publicKey: 'GNEW',
            weight: 1,
            role: 'member',
          },
        },
        signerB.publicKey(), // role: member
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects adding a signer who is already a member', async () => {
    await expect(
      service.propose(
        'acc1',
        {
          ...baseDto,
          pendingChange: {
            kind: 'member.add',
            publicKey: signerB.publicKey(),
            weight: 1,
            role: 'member',
          },
        },
        signerA.publicKey(),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects thresholds that exceed the total signer weight', async () => {
    await expect(
      service.propose(
        'acc1',
        {
          ...baseDto,
          pendingChange: { kind: 'thresholds.set', low: 1, medium: 2, high: 4 },
        },
        signerA.publicKey(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores a valid pendingChange on the transaction', async () => {
    const pendingChange = {
      kind: 'member.add' as const,
      publicKey: 'GNEWSIGNER',
      weight: 1,
      role: 'member' as const,
    };
    prismaMock.transaction.create.mockResolvedValue({
      id: 'tx1',
      accountId: 'acc1',
      type: 'config',
      xdr: 'AAAA',
      status: 'pending',
      requiredThreshold: 3,
      proposedBy: signerA.publicKey(),
      memo: null,
      submittedHash: null,
    });

    await service.propose(
      'acc1',
      { ...baseDto, pendingChange },
      signerA.publicKey(),
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pendingChange, requiredThreshold: 3 }),
    });
  });
});

describe('TransactionsService.submit', () => {
  let service: TransactionsService;
  const txDbMock = {
    transaction: { update: jest.fn() },
    user: { upsert: jest.fn() },
    accountMember: { upsert: jest.fn(), deleteMany: jest.fn() },
    multisigAccount: { update: jest.fn() },
    activityLog: { create: jest.fn() },
  };
  const prismaMock = {
    transaction: { findUnique: jest.fn(), update: jest.fn() },
    accountMember: { findMany: jest.fn() },
    $transaction: jest.fn(
      async (fn: (db: typeof txDbMock) => Promise<unknown>) => fn(txDbMock),
    ),
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
      account: { network: 'mainnet' },
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

  function mockSuccessfulSubmit(hash = 'abc123') {
    const getTransaction = jest
      .fn()
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS' });
    const server = {
      sendTransaction: jest.fn().mockResolvedValue({ status: 'PENDING', hash }),
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
  }

  it('submits successfully with a mocked RPC server', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    prismaMock.transaction.findUnique.mockResolvedValue({
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'ready',
      requiredThreshold: 1,
      xdr,
      pendingChange: null,
      signatures: [{ signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr }],
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 1 },
    ]);
    mockSuccessfulSubmit();

    const result = await service.submit('tx1');

    expect(result).toEqual({ hash: 'abc123', status: 'submitted' });
    expect(txDbMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: 'submitted', submittedHash: 'abc123', lastError: null },
    });
    // No pendingChange → the roster stays untouched.
    expect(txDbMock.accountMember.upsert).not.toHaveBeenCalled();
    expect(txDbMock.multisigAccount.update).not.toHaveBeenCalled();
  });

  it('refuses to resubmit a failed (spent) envelope', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'failed',
      requiredThreshold: 1,
      xdr: 'AAAA',
      lastError: 'The envelope expired before submission. Propose it again.',
      signatures: [],
    });

    await expect(service.submit('tx1')).rejects.toThrow(
      /failed on-chain and its envelope is spent/,
    );
  });

  it('applies a deferred member.add change after on-chain submission', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    prismaMock.transaction.findUnique.mockResolvedValue({
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'ready',
      requiredThreshold: 1,
      xdr,
      proposedBy: signerA.publicKey(),
      pendingChange: {
        kind: 'member.add',
        publicKey: signerB.publicKey(),
        weight: 2,
        role: 'member',
      },
      signatures: [{ signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr }],
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 1 },
    ]);
    mockSuccessfulSubmit();

    await service.submit('tx1');

    expect(txDbMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicKey: signerB.publicKey() } }),
    );
    expect(txDbMock.accountMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accountId: 'acc1',
          publicKey: signerB.publicKey(),
          weight: 2,
          role: 'member',
        }),
      }),
    );
    expect(txDbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'member.added' }),
      }),
    );
  });

  it('applies a deferred thresholds.set change after on-chain submission', async () => {
    const xdr = buildUnsignedXdr();
    const sigXdr = signatureFor(xdr, signerA);
    prismaMock.transaction.findUnique.mockResolvedValue({
      account: { network: 'mainnet' },
      id: 'tx1',
      accountId: 'acc1',
      status: 'ready',
      requiredThreshold: 1,
      xdr,
      proposedBy: signerA.publicKey(),
      pendingChange: { kind: 'thresholds.set', low: 1, medium: 2, high: 2 },
      signatures: [{ signerPublicKey: signerA.publicKey(), signatureXdr: sigXdr }],
    });
    prismaMock.accountMember.findMany.mockResolvedValue([
      { publicKey: signerA.publicKey(), weight: 1 },
    ]);
    mockSuccessfulSubmit();

    await service.submit('tx1');

    expect(txDbMock.multisigAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc1' },
      data: { low: 1, medium: 2, high: 2 },
    });
  });
});
