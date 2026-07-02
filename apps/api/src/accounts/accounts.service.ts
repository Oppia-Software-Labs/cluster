import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AccountThresholds,
  AddAccountMemberRequest,
  CreateMultisigAccountRequest,
  MultisigAccount,
  MultisigAccountWithMembers,
  AccountMember,
} from '@cluster/shared';
import { PrismaService } from '../prisma/prisma.service';
import { accountWhere } from '../common/account-ref';

// Prisma rows include the flat threshold columns + relations; the API surface
// uses the nested `@cluster/shared` shapes. These helpers map between them so
// Prisma types never leak past the service boundary.
type AccountRow = Prisma.MultisigAccountGetPayload<{ include: { members: true } }>;
type MemberRow = Prisma.AccountMemberGetPayload<object>;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a multisig account after its on-chain bootstrap has been submitted.
   * The creator is forced to `owner` and must be among the supplied members
   * (they are a signer on the account they create). Runs in a single
   * transaction so a partial account (no members) can never exist.
   */
  async create(
    creatorPublicKey: string,
    dto: CreateMultisigAccountRequest,
  ): Promise<MultisigAccountWithMembers> {
    const creatorInList = dto.members.some(
      (m) => m.publicKey === creatorPublicKey,
    );
    if (!creatorInList) {
      throw new ForbiddenException(
        'The authenticated creator must be one of the account members',
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // FK: AccountMember.publicKey -> User.publicKey. Members may be brand
        // new to Cluster, so upsert a User row for each before linking.
        for (const m of dto.members) {
          await tx.user.upsert({
            where: { publicKey: m.publicKey },
            update: {},
            create: { publicKey: m.publicKey },
          });
        }

        const account = await tx.multisigAccount.create({
          data: {
            name: dto.name,
            stellarAccountId: dto.stellarAccountId,
            network: 'mainnet',
            createdBy: creatorPublicKey,
            low: dto.thresholds.low,
            medium: dto.thresholds.medium,
            high: dto.thresholds.high,
            members: {
              create: dto.members.map((m) => ({
                publicKey: m.publicKey,
                weight: m.weight,
                // The creator owns the account regardless of the role they were
                // listed with; everyone else keeps their supplied role.
                role: m.publicKey === creatorPublicKey ? 'owner' : m.role,
              })),
            },
          },
          include: { members: true },
        });

        await tx.activityLog.create({
          data: {
            accountId: account.id,
            actor: creatorPublicKey,
            action: 'account.created',
            metadata: {
              name: account.name,
              stellarAccountId: account.stellarAccountId,
              memberCount: dto.members.length,
            },
          },
        });

        return account;
      });

      return this.toAccountWithMembers(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A multisig account for this Stellar account already exists',
        );
      }
      throw e;
    }
  }

  /** Accounts the caller is a member of. */
  async listForUser(publicKey: string): Promise<MultisigAccount[]> {
    const rows = await this.prisma.multisigAccount.findMany({
      where: { members: { some: { publicKey } } },
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toAccount(r));
  }

  /** Single account with members; 404 if missing, 403 if caller is not a member. */
  async getById(
    accountId: string,
    requesterPublicKey: string,
  ): Promise<MultisigAccountWithMembers> {
    const row = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
      include: { members: true },
    });
    if (!row) {
      throw new NotFoundException('Account not found');
    }
    this.assertMemberOf(row, requesterPublicKey);
    return this.toAccountWithMembers(row);
  }

  /** Member list for an account the caller belongs to. */
  async getMembers(
    accountId: string,
    requesterPublicKey: string,
  ): Promise<AccountMember[]> {
    const row = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
      include: { members: true },
    });
    if (!row) {
      throw new NotFoundException('Account not found');
    }
    this.assertMemberOf(row, requesterPublicKey);
    return row.members.map((m) => this.toMember(m));
  }

  /**
   * Add a signer to an account. Updates Cluster's off-chain record so the
   * roster and threshold math stay in sync across the app; on-chain
   * enforcement of the new signer is a separate config transaction (see
   * `buildAddMemberTx` in @cluster/stellar) run through the signing pipeline.
   * Restricted to owners/admins.
   */
  async addMember(
    accountId: string,
    requesterPublicKey: string,
    dto: AddAccountMemberRequest,
  ): Promise<MultisigAccountWithMembers> {
    const row = await this.loadManageable(accountId, requesterPublicKey);

    if (row.members.some((m) => m.publicKey === dto.publicKey)) {
      throw new ConflictException('That signer is already a member');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // FK: AccountMember.publicKey -> User.publicKey. The signer may be new.
      await tx.user.upsert({
        where: { publicKey: dto.publicKey },
        update: {},
        create: { publicKey: dto.publicKey },
      });
      await tx.accountMember.create({
        data: {
          accountId: row.id,
          publicKey: dto.publicKey,
          weight: dto.weight,
          // Only the account creator holds `owner`; new signers cannot claim it.
          role: dto.role === 'owner' ? 'admin' : dto.role,
        },
      });
      await tx.activityLog.create({
        data: {
          accountId: row.id,
          actor: requesterPublicKey,
          action: 'member.added',
          metadata: { publicKey: dto.publicKey, weight: dto.weight, role: dto.role },
        },
      });
      return tx.multisigAccount.findUniqueOrThrow({
        where: { id: row.id },
        include: { members: true },
      });
    });

    return this.toAccountWithMembers(updated);
  }

  /**
   * Remove a signer. Owners can never be removed (there must always be a
   * controlling key), and an account must keep at least one member. Restricted
   * to owners/admins.
   */
  async removeMember(
    accountId: string,
    requesterPublicKey: string,
    memberId: string,
  ): Promise<MultisigAccountWithMembers> {
    const row = await this.loadManageable(accountId, requesterPublicKey);

    const target = row.members.find((m) => m.id === memberId);
    if (!target) {
      throw new NotFoundException('Member not found on this account');
    }
    if (target.role === 'owner') {
      throw new BadRequestException('The account owner cannot be removed');
    }
    if (row.members.length <= 1) {
      throw new BadRequestException('An account must keep at least one member');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountMember.delete({ where: { id: memberId } });
      await tx.activityLog.create({
        data: {
          accountId: row.id,
          actor: requesterPublicKey,
          action: 'member.removed',
          metadata: { publicKey: target.publicKey },
        },
      });
      return tx.multisigAccount.findUniqueOrThrow({
        where: { id: row.id },
        include: { members: true },
      });
    });

    return this.toAccountWithMembers(updated);
  }

  /**
   * Update the low/medium/high signing thresholds. Each threshold must be
   * satisfiable by the current combined signer weight, otherwise the account
   * could lock itself out. Restricted to owners/admins.
   */
  async updateThresholds(
    accountId: string,
    requesterPublicKey: string,
    thresholds: AccountThresholds,
  ): Promise<MultisigAccountWithMembers> {
    const row = await this.loadManageable(accountId, requesterPublicKey);

    const totalWeight = row.members.reduce((sum, m) => sum + m.weight, 0);
    const tooHigh = (['low', 'medium', 'high'] as const).find(
      (level) => thresholds[level] > totalWeight,
    );
    if (tooHigh) {
      throw new BadRequestException(
        `The ${tooHigh} threshold (${thresholds[tooHigh]}) exceeds the total signer weight (${totalWeight})`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.multisigAccount.update({
        where: { id: row.id },
        data: { low: thresholds.low, medium: thresholds.medium, high: thresholds.high },
      });
      await tx.activityLog.create({
        data: {
          accountId: row.id,
          actor: requesterPublicKey,
          action: 'thresholds.updated',
          metadata: { ...thresholds },
        },
      });
      return tx.multisigAccount.findUniqueOrThrow({
        where: { id: row.id },
        include: { members: true },
      });
    });

    return this.toAccountWithMembers(updated);
  }

  /** Load an account, 404/403-guarding for existence and manage permission. */
  private async loadManageable(
    accountId: string,
    requesterPublicKey: string,
  ): Promise<AccountRow> {
    const row = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
      include: { members: true },
    });
    if (!row) {
      throw new NotFoundException('Account not found');
    }
    const me = row.members.find((m) => m.publicKey === requesterPublicKey);
    if (!me) {
      throw new ForbiddenException('Not a member of this account');
    }
    if (me.role !== 'owner' && me.role !== 'admin') {
      throw new ForbiddenException(
        'Only owners and admins can manage members and thresholds',
      );
    }
    return row;
  }

  private assertMemberOf(row: AccountRow, publicKey: string): void {
    if (!row.members.some((m) => m.publicKey === publicKey)) {
      throw new ForbiddenException('Not a member of this account');
    }
  }

  private toAccount(row: AccountRow): MultisigAccount {
    return {
      id: row.id,
      name: row.name,
      stellarAccountId: row.stellarAccountId,
      network: 'mainnet',
      createdBy: row.createdBy,
      thresholds: { low: row.low, medium: row.medium, high: row.high },
    };
  }

  private toAccountWithMembers(row: AccountRow): MultisigAccountWithMembers {
    return {
      ...this.toAccount(row),
      members: row.members.map((m) => this.toMember(m)),
    };
  }

  private toMember(m: MemberRow): AccountMember {
    return {
      id: m.id,
      accountId: m.accountId,
      publicKey: m.publicKey,
      weight: m.weight,
      role: m.role,
    };
  }
}
