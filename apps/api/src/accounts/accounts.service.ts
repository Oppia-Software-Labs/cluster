import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateMultisigAccountRequest,
  MultisigAccount,
  MultisigAccountWithMembers,
  AccountMember,
} from '@cluster/shared';
import { PrismaService } from '../prisma/prisma.service';

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
      where: { id: accountId },
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
      where: { id: accountId },
      include: { members: true },
    });
    if (!row) {
      throw new NotFoundException('Account not found');
    }
    this.assertMemberOf(row, requesterPublicKey);
    return row.members.map((m) => this.toMember(m));
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
