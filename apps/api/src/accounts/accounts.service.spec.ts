import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateMultisigAccountRequest } from '@cluster/shared';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';

const CREATOR = 'GCREATORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const MEMBER = 'GMEMBERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

function accountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'acc_1',
    name: 'Treasury',
    stellarAccountId: 'GACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    network: 'mainnet',
    createdBy: CREATOR,
    low: 1,
    medium: 2,
    high: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [
      { id: 'm1', accountId: 'acc_1', publicKey: CREATOR, weight: 2, role: 'owner', createdAt: new Date() },
      { id: 'm2', accountId: 'acc_1', publicKey: MEMBER, weight: 1, role: 'member', createdAt: new Date() },
    ],
    ...overrides,
  };
}

function createDto(): CreateMultisigAccountRequest {
  return {
    name: 'Treasury',
    stellarAccountId: 'GACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    thresholds: { low: 1, medium: 2, high: 3 },
    members: [
      { publicKey: CREATOR, weight: 2, role: 'member' },
      { publicKey: MEMBER, weight: 1, role: 'member' },
    ],
  };
}

describe('AccountsService', () => {
  let service: AccountsService;
  let prismaMock: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = {
      user: { upsert: jest.fn().mockResolvedValue({}) },
      multisigAccount: { create: jest.fn() },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prismaMock = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      multisigAccount: { findMany: jest.fn(), findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(AccountsService);
  });

  describe('create', () => {
    it('persists the account + members, forces creator to owner, returns nested thresholds', async () => {
      txMock.multisigAccount.create.mockResolvedValue(accountRow());

      const result = await service.create(CREATOR, createDto());

      // every member's User is upserted (FK safety)
      expect(txMock.user.upsert).toHaveBeenCalledTimes(2);
      // creator's role is forced to owner regardless of the supplied role
      const created = txMock.multisigAccount.create.mock.calls[0][0];
      const creatorMember = created.data.members.create.find(
        (m: { publicKey: string }) => m.publicKey === CREATOR,
      );
      expect(creatorMember.role).toBe('owner');
      // flat threshold columns written from the nested dto
      expect(created.data).toMatchObject({ low: 1, medium: 2, high: 3, createdBy: CREATOR });
      // activity log recorded
      expect(txMock.activityLog.create).toHaveBeenCalled();
      // response uses the nested shared shape, not Prisma's flat columns
      expect(result.thresholds).toEqual({ low: 1, medium: 2, high: 3 });
      expect(result).not.toHaveProperty('low');
      expect(result.members).toHaveLength(2);
    });

    it('rejects when the authenticated creator is not among the members', async () => {
      const dto = createDto();
      dto.members = [{ publicKey: MEMBER, weight: 1, role: 'member' }];
      await expect(service.create(CREATOR, dto)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint violation to 409 Conflict', async () => {
      txMock.multisigAccount.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(CREATOR, createDto())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listForUser', () => {
    it('returns the caller accounts mapped to the nested shape', async () => {
      prismaMock.multisigAccount.findMany.mockResolvedValue([accountRow()]);
      const result = await service.listForUser(CREATOR);
      expect(prismaMock.multisigAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { members: { some: { publicKey: CREATOR } }, network: 'mainnet' } }),
      );
      expect(result[0].thresholds).toEqual({ low: 1, medium: 2, high: 3 });
    });
  });

  describe('getById', () => {
    it('throws NotFound when the account does not exist', async () => {
      prismaMock.multisigAccount.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing', CREATOR)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when the caller is not a member', async () => {
      prismaMock.multisigAccount.findUnique.mockResolvedValue(accountRow());
      await expect(service.getById('acc_1', 'GSTRANGER')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the account with members for a member', async () => {
      prismaMock.multisigAccount.findUnique.mockResolvedValue(accountRow());
      const result = await service.getById('acc_1', MEMBER);
      expect(result.id).toBe('acc_1');
      expect(result.members.map((m) => m.publicKey)).toContain(MEMBER);
    });
  });

  describe('getMembers', () => {
    it('throws Forbidden for a non-member', async () => {
      prismaMock.multisigAccount.findUnique.mockResolvedValue(accountRow());
      await expect(service.getMembers('acc_1', 'GSTRANGER')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns members for a member', async () => {
      prismaMock.multisigAccount.findUnique.mockResolvedValue(accountRow());
      const members = await service.getMembers('acc_1', CREATOR);
      expect(members).toHaveLength(2);
      expect(members[0]).toHaveProperty('weight');
    });
  });
});
