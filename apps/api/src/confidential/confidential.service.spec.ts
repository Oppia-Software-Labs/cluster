import { NotFoundException } from '@nestjs/common';
import { ConfidentialService } from './confidential.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConfidentialService', () => {
  const prisma = {
    multisigAccount: { findUnique: jest.fn() },
    confidentialWrapKey: { upsert: jest.fn(), findUnique: jest.fn() },
    confidentialKeyEnvelope: { upsert: jest.fn(), findMany: jest.fn() },
    confidentialOpening: { upsert: jest.fn(), findMany: jest.fn() },
    confidentialRegistration: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new ConfidentialService(prisma as unknown as PrismaService);
  const ACC = { id: 'acc_1', stellarAccountId: 'GACC' };

  beforeEach(() => jest.clearAllMocks());

  it('putOpening upserts on (accountId, eventKey) — idempotent, never duplicates', async () => {
    prisma.multisigAccount.findUnique.mockResolvedValue(ACC);
    prisma.confidentialOpening.upsert.mockResolvedValue({
      accountId: 'acc_1',
      eventKey: 'led:7:0',
      ciphertext: 'CIPHER',
    });
    await service.putOpening('GACC', { eventKey: 'led:7:0', ciphertext: 'CIPHER' });
    const call = prisma.confidentialOpening.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      accountId_eventKey: { accountId: 'acc_1', eventKey: 'led:7:0' },
    });
    // Blindness: the ONLY payload field persisted is opaque ciphertext.
    expect(JSON.stringify({ ...call.create, ...call.update })).not.toMatch(
      /amount|blind|scalar|secret|\bsk\b/i,
    );
  });

  it('putEnvelope upserts on (accountId, memberPublicKey) — stores only ciphertext', async () => {
    prisma.multisigAccount.findUnique.mockResolvedValue(ACC);
    prisma.confidentialKeyEnvelope.upsert.mockResolvedValue({
      accountId: 'acc_1',
      memberPublicKey: 'GMEM',
      ciphertext: 'SEALED',
    });
    await service.putEnvelope('GACC', { memberPublicKey: 'GMEM', ciphertext: 'SEALED' });
    const call = prisma.confidentialKeyEnvelope.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      accountId_memberPublicKey: { accountId: 'acc_1', memberPublicKey: 'GMEM' },
    });
    expect(Object.keys(call.create).sort()).toEqual(
      ['accountId', 'ciphertext', 'memberPublicKey'].sort(),
    );
  });

  it('publishWrapKey upserts on userPublicKey and stores only the public key', async () => {
    prisma.confidentialWrapKey.upsert.mockResolvedValue({
      userPublicKey: 'GME',
      wrapPublicKey: 'PUB',
    });
    await service.publishWrapKey('GME', { wrapPublicKey: 'PUB' });
    const call = prisma.confidentialWrapKey.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userPublicKey: 'GME' });
    expect(call.create).toEqual({ userPublicKey: 'GME', wrapPublicKey: 'PUB' });
  });

  it('getRegistration 404s when the account has none', async () => {
    prisma.multisigAccount.findUnique.mockResolvedValue(ACC);
    prisma.confidentialRegistration.findUnique.mockResolvedValue(null);
    await expect(service.getRegistration('GACC')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves unknown account to 404', async () => {
    prisma.multisigAccount.findUnique.mockResolvedValue(null);
    await expect(
      service.putOpening('GNOPE', { eventKey: 'e', ciphertext: 'c' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
