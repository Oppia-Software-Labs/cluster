import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdvanceRegistrationDto,
  ConfidentialRegistrationDto,
  KeyEnvelopeDto,
  KeyEnvelopeResponse,
  OpeningBlobDto,
  OpeningBlobResponse,
  RegistrationResponse,
  WrapKeyDto,
  WrapKeyResponse,
} from '@cluster/shared';
import { PrismaService } from '../prisma/prisma.service';
import { accountWhere } from '../common/account-ref';

/**
 * Server-blind confidential control plane. Persists ONLY ciphertext and public
 * material — never `sk`, amounts, or blinding factors (see spec §5.1, §5.3).
 * Route `:id` params resolve to the account row via accountWhere(); relations
 * always use the resolved `account.id`, never the raw param.
 */
@Injectable()
export class ConfidentialService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveAccountId(ref: string): Promise<string> {
    const account = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(ref),
      select: { id: true },
    });
    if (!account) throw new NotFoundException(`Account ${ref} not found`);
    return account.id;
  }

  // ── Wrap keys (per user) ───────────────────────────────────────────────
  async publishWrapKey(
    userPublicKey: string,
    dto: WrapKeyDto,
  ): Promise<WrapKeyResponse> {
    const row = await this.prisma.confidentialWrapKey.upsert({
      where: { userPublicKey },
      create: { userPublicKey, wrapPublicKey: dto.wrapPublicKey },
      update: { wrapPublicKey: dto.wrapPublicKey },
    });
    return { userPublicKey: row.userPublicKey, wrapPublicKey: row.wrapPublicKey };
  }

  async getWrapKey(userPublicKey: string): Promise<WrapKeyResponse> {
    const row = await this.prisma.confidentialWrapKey.findUnique({
      where: { userPublicKey },
    });
    if (!row) {
      throw new NotFoundException(`No wrap key published for ${userPublicKey}`);
    }
    return { userPublicKey: row.userPublicKey, wrapPublicKey: row.wrapPublicKey };
  }

  // ── Key envelopes (sk sealed per member) ───────────────────────────────
  async putEnvelope(
    ref: string,
    dto: KeyEnvelopeDto,
  ): Promise<KeyEnvelopeResponse> {
    const accountId = await this.resolveAccountId(ref);
    const row = await this.prisma.confidentialKeyEnvelope.upsert({
      where: {
        accountId_memberPublicKey: {
          accountId,
          memberPublicKey: dto.memberPublicKey,
        },
      },
      create: {
        accountId,
        memberPublicKey: dto.memberPublicKey,
        ciphertext: dto.ciphertext,
      },
      update: { ciphertext: dto.ciphertext },
    });
    return {
      accountId: row.accountId,
      memberPublicKey: row.memberPublicKey,
      ciphertext: row.ciphertext,
    };
  }

  async listEnvelopes(ref: string): Promise<KeyEnvelopeResponse[]> {
    const accountId = await this.resolveAccountId(ref);
    const rows = await this.prisma.confidentialKeyEnvelope.findMany({
      where: { accountId },
    });
    return rows.map((r) => ({
      accountId: r.accountId,
      memberPublicKey: r.memberPublicKey,
      ciphertext: r.ciphertext,
    }));
  }

  // ── Openings (k_store-encrypted event openings) ────────────────────────
  async putOpening(
    ref: string,
    dto: OpeningBlobDto,
  ): Promise<OpeningBlobResponse> {
    const accountId = await this.resolveAccountId(ref);
    // Idempotent on (accountId, eventKey): re-posting the same event is a
    // no-op update, never a duplicate row (§8, Z3 testing note).
    const row = await this.prisma.confidentialOpening.upsert({
      where: { accountId_eventKey: { accountId, eventKey: dto.eventKey } },
      create: { accountId, eventKey: dto.eventKey, ciphertext: dto.ciphertext },
      update: { ciphertext: dto.ciphertext },
    });
    return {
      accountId: row.accountId,
      eventKey: row.eventKey,
      ciphertext: row.ciphertext,
    };
  }

  async listOpenings(ref: string): Promise<OpeningBlobResponse[]> {
    const accountId = await this.resolveAccountId(ref);
    const rows = await this.prisma.confidentialOpening.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      accountId: r.accountId,
      eventKey: r.eventKey,
      ciphertext: r.ciphertext,
    }));
  }

  // ── Registration ───────────────────────────────────────────────────────
  async createRegistration(
    ref: string,
    dto: ConfidentialRegistrationDto,
  ): Promise<RegistrationResponse> {
    const accountId = await this.resolveAccountId(ref);
    const row = await this.prisma.confidentialRegistration.create({
      data: {
        accountId,
        tokenContract: dto.tokenContract,
        auditorId: dto.auditorId,
        spendingPubKey: dto.spendingPubKey,
        // status defaults to `pending`; advanced to `registered` after the
        // on-chain register event is observed.
      },
    });
    return this.toRegistration(row);
  }

  async advanceRegistration(
    ref: string,
    dto: AdvanceRegistrationDto,
  ): Promise<RegistrationResponse> {
    const accountId = await this.resolveAccountId(ref);
    const existing = await this.prisma.confidentialRegistration.findUnique({
      where: { accountId },
    });
    if (!existing) {
      throw new NotFoundException(
        `No confidential registration for account ${ref}`,
      );
    }
    const row = await this.prisma.confidentialRegistration.update({
      where: { accountId },
      data: { status: dto.status },
    });
    return this.toRegistration(row);
  }

  async getRegistration(ref: string): Promise<RegistrationResponse> {
    const accountId = await this.resolveAccountId(ref);
    const row = await this.prisma.confidentialRegistration.findUnique({
      where: { accountId },
    });
    if (!row) {
      throw new NotFoundException(
        `No confidential registration for account ${ref}`,
      );
    }
    return this.toRegistration(row);
  }

  private toRegistration(row: {
    accountId: string;
    tokenContract: string;
    auditorId: number;
    status: 'pending' | 'registered';
    spendingPubKey: string;
  }): RegistrationResponse {
    return {
      accountId: row.accountId,
      tokenContract: row.tokenContract,
      auditorId: row.auditorId,
      status: row.status,
      spendingPubKey: row.spendingPubKey,
    };
  }
}
