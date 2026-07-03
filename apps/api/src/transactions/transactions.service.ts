import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AccountMember as PrismaAccountMember,
  MultisigAccount,
  Signature as PrismaSignature,
  Transaction as PrismaTransaction,
  ThresholdLevel,
} from '@prisma/client';
import {
  configChangeSchema,
  type AddSignatureDto,
  type ConfigChange,
  type ProposeTransactionDto,
  type Signature,
  type SubmitTransactionResponse,
  type Transaction,
  type TransactionWithSignatures,
} from '@cluster/shared';
import {
  combineSignatures,
  getNetworkPassphrase,
  getRpcServer,
  getRpcUrl,
  getStellarNetwork,
  isThresholdMet,
  submitSignedXdr,
  type CollectedSignature,
  type SignerWeights,
} from '@cluster/stellar';
import { PrismaService } from '../prisma/prisma.service';
import { accountWhere } from '../common/account-ref';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  resolveRequiredThreshold(
    account: Pick<MultisigAccount, 'low' | 'medium' | 'high'>,
    level: ThresholdLevel,
  ): number {
    switch (level) {
      case 'low':
        return account.low;
      case 'medium':
        return account.medium;
      case 'high':
        return account.high;
    }
  }

  async propose(
    accountId: string,
    dto: ProposeTransactionDto,
    proposedBy: string,
  ): Promise<Transaction> {
    const account = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
      include: { members: true },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (dto.pendingChange) {
      this.assertChangeProposable(account, proposedBy, dto);
    }

    const requiredThreshold = this.resolveRequiredThreshold(
      account,
      dto.thresholdLevel,
    );

    const tx = await this.prisma.transaction.create({
      data: {
        accountId: account.id,
        type: dto.type,
        xdr: dto.xdr,
        status: 'pending',
        requiredThreshold,
        proposedBy,
        memo: dto.memo,
        network: dto.network ?? getStellarNetwork(),
        pendingChange: dto.pendingChange,
      },
    });

    return this.toTransaction(tx);
  }

  /**
   * Guard a config proposal carrying a pendingChange. Mirrors the direct
   * accounts endpoints: only owners/admins may change the roster/thresholds,
   * and the change must be applicable so a doomed proposal is rejected before
   * anyone wastes a signature on it. The change is only APPLIED after the
   * transaction is submitted on-chain (see `applyConfigChange`).
   */
  private assertChangeProposable(
    account: MultisigAccount & { members: PrismaAccountMember[] },
    proposedBy: string,
    dto: ProposeTransactionDto,
  ): void {
    if (dto.type !== 'config') {
      throw new BadRequestException(
        'pendingChange is only valid on config transactions',
      );
    }
    const me = account.members.find((m) => m.publicKey === proposedBy);
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
      throw new ForbiddenException(
        'Only owners and admins can propose member and threshold changes',
      );
    }

    const change = dto.pendingChange as ConfigChange;
    switch (change.kind) {
      case 'member.add':
        if (account.members.some((m) => m.publicKey === change.publicKey)) {
          throw new ConflictException('That signer is already a member');
        }
        break;
      case 'member.remove': {
        const target = account.members.find(
          (m) => m.publicKey === change.publicKey,
        );
        if (!target) {
          throw new NotFoundException('Member not found on this account');
        }
        if (target.role === 'owner') {
          throw new BadRequestException('The account owner cannot be removed');
        }
        if (account.members.length <= 1) {
          throw new BadRequestException(
            'An account must keep at least one member',
          );
        }
        break;
      }
      case 'thresholds.set': {
        const totalWeight = account.members.reduce((s, m) => s + m.weight, 0);
        const tooHigh = (['low', 'medium', 'high'] as const).find(
          (level) => change[level] > totalWeight,
        );
        if (tooHigh) {
          throw new BadRequestException(
            `The ${tooHigh} threshold (${change[tooHigh]}) exceeds the total signer weight (${totalWeight})`,
          );
        }
        break;
      }
    }
  }

  async addSignature(
    transactionId: string,
    dto: AddSignatureDto,
  ): Promise<Signature> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    if (tx.status === 'submitted') {
      throw new BadRequestException('Transaction already submitted');
    }

    const member = await this.prisma.accountMember.findUnique({
      where: {
        accountId_publicKey: {
          accountId: tx.accountId,
          publicKey: dto.signerPublicKey,
        },
      },
    });
    if (!member) {
      throw new BadRequestException(
        `Signer ${dto.signerPublicKey} is not a member of this account`,
      );
    }

    const signature = await this.prisma.signature.upsert({
      where: {
        transactionId_signerPublicKey: {
          transactionId,
          signerPublicKey: dto.signerPublicKey,
        },
      },
      create: {
        transactionId,
        signerPublicKey: dto.signerPublicKey,
        signatureXdr: dto.signatureXdr,
        weight: member.weight,
      },
      update: {
        signatureXdr: dto.signatureXdr,
        weight: member.weight,
      },
    });

    // Signing is the user action; submission is Cluster's job. The moment the
    // collected weight satisfies the threshold, the transaction is combined
    // and broadcast automatically — best-effort here so a submission failure
    // never voids the signature itself (the failure lands on the tx row).
    await this.settleThreshold(tx.id).catch(() => undefined);

    return this.toSignature(signature);
  }

  /**
   * Manual submission retry. Only meaningful for a `ready` transaction whose
   * automatic submission hit a transient error (RPC outage etc). `failed`
   * envelopes are spent — their sequence number and/or timebounds are consumed
   * — so they can never be resubmitted and must be proposed again.
   */
  async submit(transactionId: string): Promise<SubmitTransactionResponse> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { signatures: true },
    });
    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    if (tx.status === 'submitted') {
      throw new ConflictException('Transaction already submitted');
    }
    if (tx.status === 'failed') {
      throw new ConflictException(
        `This transaction already failed on-chain and its envelope is spent — propose it again.${tx.lastError ? ` Reason: ${tx.lastError}` : ''}`,
      );
    }

    const members = await this.prisma.accountMember.findMany({
      where: { accountId: tx.accountId },
    });
    const weights = this.buildSignerWeights(members);
    const collected = this.buildCollectedSignatures(tx.signatures);

    if (!isThresholdMet(collected, weights, tx.requiredThreshold)) {
      throw new BadRequestException('threshold not met');
    }

    return this.submitCombined(tx, collected);
  }

  /**
   * If the transaction's collected signatures now satisfy its threshold, mark
   * it ready and submit it on-chain. Called after every new signature.
   */
  private async settleThreshold(transactionId: string): Promise<void> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { signatures: true },
    });
    if (!tx || (tx.status !== 'pending' && tx.status !== 'ready')) {
      return;
    }

    const members = await this.prisma.accountMember.findMany({
      where: { accountId: tx.accountId },
    });
    const weights = this.buildSignerWeights(members);
    const collected = this.buildCollectedSignatures(tx.signatures);

    if (!isThresholdMet(collected, weights, tx.requiredThreshold)) {
      return;
    }

    if (tx.status === 'pending') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'ready' },
      });
    }

    await this.submitCombined(tx, collected);
  }

  /**
   * Combine the collected signatures and broadcast. On success the status flip
   * and any deferred config change land atomically; on failure the decoded
   * Stellar result codes are stored in `lastError` so the UI can say WHY.
   */
  private async submitCombined(
    tx: PrismaTransaction & { signatures: PrismaSignature[] },
    collected: CollectedSignature[],
  ): Promise<SubmitTransactionResponse> {
    const network = toNetwork(tx.network);
    const passphrase = getNetworkPassphrase(network);
    const signedXdr = combineSignatures(tx.xdr, collected, passphrase);

    // Only override the RPC server when the envelope targets a DIFFERENT
    // network than the active one (the DeFindex testnet opt-in on mainnet).
    // Same-network submissions keep relying on submitSignedXdr's own default
    // (getRpcServer()) so mocks/tests that inject a fake `server` are unaffected.
    const server =
      network !== getStellarNetwork() ? getRpcServer(getRpcUrl(network)) : undefined;

    let result: Awaited<ReturnType<typeof submitSignedXdr>>;
    try {
      result = await submitSignedXdr(signedXdr, {
        ...(server ? { server } : {}),
        networkPassphrase: passphrase,
      });
    } catch (err) {
      const reason = describeStellarError(
        err instanceof Error ? err.message : String(err),
      );
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'failed', lastError: reason },
      });
      throw new BadRequestException(`Submission failed: ${reason}`);
    }

    // submitSignedXdr resolves for FAILED results too — only SUCCESS means
    // the chain applied the transaction. The fee is charged and the sequence
    // consumed either way, so a FAILED envelope is permanently spent.
    if (result.status !== 'SUCCESS') {
      const reason = describeTxResult(result.resultXdr) ?? result.status;
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'failed',
          submittedHash: result.hash,
          lastError: reason,
        },
      });
      throw new BadRequestException(`Transaction failed on-chain: ${reason}`);
    }

    await this.prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: 'submitted', submittedHash: result.hash, lastError: null },
      });
      const change = this.parsePendingChange(tx.pendingChange);
      if (change) {
        await this.applyConfigChange(db, tx.accountId, tx.proposedBy, change);
      }
    });

    return { hash: result.hash, status: 'submitted' };
  }

  /**
   * Apply a deferred roster/threshold change after its config transaction has
   * been submitted on-chain. Runs inside the submit $transaction so the status
   * flip and the roster update land together. Mirrors the mutations in
   * AccountsService, minus the pre-checks (validated at propose time; the
   * operations are idempotent-safe re-checked here where cheap).
   */
  private async applyConfigChange(
    db: Prisma.TransactionClient,
    accountId: string,
    actor: string,
    change: ConfigChange,
  ): Promise<void> {
    switch (change.kind) {
      case 'member.add': {
        // FK: AccountMember.publicKey -> User.publicKey. The signer may be new.
        await db.user.upsert({
          where: { publicKey: change.publicKey },
          update: {},
          create: { publicKey: change.publicKey },
        });
        await db.accountMember.upsert({
          where: {
            accountId_publicKey: { accountId, publicKey: change.publicKey },
          },
          update: { weight: change.weight },
          create: {
            accountId,
            publicKey: change.publicKey,
            weight: change.weight,
            // Only the account creator holds `owner`; guarded again defensively.
            role: change.role === 'owner' ? 'admin' : change.role,
          },
        });
        await db.activityLog.create({
          data: {
            accountId,
            actor,
            action: 'member.added',
            metadata: {
              publicKey: change.publicKey,
              weight: change.weight,
              role: change.role,
            },
          },
        });
        break;
      }
      case 'member.remove': {
        await db.accountMember.deleteMany({
          where: { accountId, publicKey: change.publicKey },
        });
        await db.activityLog.create({
          data: {
            accountId,
            actor,
            action: 'member.removed',
            metadata: { publicKey: change.publicKey },
          },
        });
        break;
      }
      case 'thresholds.set': {
        await db.multisigAccount.update({
          where: { id: accountId },
          data: {
            low: change.low,
            medium: change.medium,
            high: change.high,
          },
        });
        await db.activityLog.create({
          data: {
            accountId,
            actor,
            action: 'thresholds.updated',
            metadata: {
              low: change.low,
              medium: change.medium,
              high: change.high,
            },
          },
        });
        break;
      }
    }
  }

  /** Parse the stored JSON column back into a typed ConfigChange (or null). */
  private parsePendingChange(value: Prisma.JsonValue | null): ConfigChange | null {
    if (value == null) return null;
    const parsed = configChangeSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  async listForAccount(accountId: string): Promise<Transaction[]> {
    const account = await this.prisma.multisigAccount.findUnique({
      where: accountWhere(accountId),
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const txs = await this.prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
    });

    return txs.map((tx) => this.toTransaction(tx));
  }

  async getWithSignatures(transactionId: string): Promise<TransactionWithSignatures> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { signatures: true },
    });
    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return {
      ...this.toTransaction(tx),
      signatures: tx.signatures.map((sig) => this.toSignature(sig)),
    };
  }

  private buildSignerWeights(
    members: { publicKey: string; weight: number }[],
  ): SignerWeights {
    const weights: SignerWeights = {};
    for (const member of members) {
      weights[member.publicKey] = member.weight;
    }
    return weights;
  }

  private buildCollectedSignatures(
    signatures: { signerPublicKey: string; signatureXdr: string }[],
  ): CollectedSignature[] {
    return signatures.map((sig) => ({
      signerPublicKey: sig.signerPublicKey,
      signatureXdr: sig.signatureXdr,
    }));
  }

  private toTransaction(tx: PrismaTransaction): Transaction {
    return {
      id: tx.id,
      accountId: tx.accountId,
      type: tx.type,
      xdr: tx.xdr,
      status: tx.status,
      requiredThreshold: tx.requiredThreshold,
      proposedBy: tx.proposedBy,
      memo: tx.memo,
      network: toNetwork(tx.network),
      submittedHash: tx.submittedHash,
      lastError: tx.lastError,
    };
  }

  private toSignature(sig: PrismaSignature): Signature {
    return {
      id: sig.id,
      transactionId: sig.transactionId,
      signerPublicKey: sig.signerPublicKey,
      signatureXdr: sig.signatureXdr,
      weight: sig.weight,
    };
  }
}

/**
 * Narrow the plain-string `network` column (Prisma has no enum for it) to
 * the literal union the pipeline expects. Any unrecognized value defaults to
 * mainnet so a corrupted row can never silently reroute to testnet and back.
 */
function toNetwork(value: string): 'mainnet' | 'testnet' {
  return value === 'testnet' ? 'testnet' : 'mainnet';
}

/** Stellar tx/op result codes mapped to messages a signer can act on. */
const FRIENDLY_CODES: Record<string, string> = {
  setOptionsLowReserve:
    'The account holds too little XLM for the reserve this change requires (each signer costs 0.5 XLM of reserve). Deposit more XLM and propose again.',
  changeTrustLowReserve:
    'The account holds too little XLM for the reserve a trustline requires (0.5 XLM). Deposit more XLM and propose again.',
  paymentUnderfunded: 'The account balance is too low for this payment.',
  paymentNoDestination: 'The destination account does not exist.',
  paymentNoTrust: 'The destination has no trustline for this asset.',
  txBadSeq:
    'The sequence number is stale (another transaction was submitted first). Propose it again.',
  txTooLate: 'The envelope expired before submission. Propose it again.',
  txBadAuth: 'The signatures do not satisfy the on-chain thresholds.',
  txInsufficientFee: 'The network fee was too low. Propose it again.',
  txInsufficientBalance: 'The account cannot cover the fee and reserves.',
};

/** Decode an included-but-FAILED transaction result into a readable reason. */
function describeTxResult(
  resultXdr: { result(): { switch(): { name: string }; results?(): unknown } } | undefined,
): string | null {
  if (!resultXdr) return null;
  const codes: string[] = [];
  try {
    codes.push(resultXdr.result().switch().name);
    const ops = (resultXdr.result().results?.() ?? []) as Array<{
      tr(): { value(): { switch?(): { name: string } } };
    }>;
    for (const op of ops) {
      const name = op.tr().value()?.switch?.().name;
      if (name && !name.endsWith('Success')) codes.push(name);
    }
  } catch {
    // partial decode is fine — whatever was collected still helps
  }
  if (codes.length === 0) return null;
  const friendly = codes.map((c) => FRIENDLY_CODES[c]).find(Boolean);
  return friendly ? `${friendly} (${codes.join(', ')})` : codes.join(', ');
}

/** Make sendTransaction/polling errors readable, mapping known codes. */
function describeStellarError(message: string): string {
  for (const [code, friendly] of Object.entries(FRIENDLY_CODES)) {
    if (message.includes(code)) return `${friendly} (${code})`;
  }
  return message;
}
