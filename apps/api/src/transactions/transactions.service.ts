import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MultisigAccount,
  Signature as PrismaSignature,
  Transaction as PrismaTransaction,
  ThresholdLevel,
} from '@prisma/client';
import {
  type AddSignatureDto,
  type ProposeTransactionDto,
  type Signature,
  type SubmitTransactionResponse,
  type Transaction,
  type TransactionWithSignatures,
} from '@cluster/shared';
import {
  combineSignatures,
  getNetworkPassphrase,
  isThresholdMet,
  submitSignedXdr,
  type CollectedSignature,
  type SignerWeights,
} from '@cluster/stellar';
import { PrismaService } from '../prisma/prisma.service';

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
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const requiredThreshold = this.resolveRequiredThreshold(
      account,
      dto.thresholdLevel,
    );

    const tx = await this.prisma.transaction.create({
      data: {
        accountId,
        type: dto.type,
        xdr: dto.xdr,
        status: 'pending',
        requiredThreshold,
        proposedBy,
        memo: dto.memo,
      },
    });

    return this.toTransaction(tx);
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

    await this.refreshReadyStatus(tx.id, tx.accountId, tx.requiredThreshold, tx.status);

    return this.toSignature(signature);
  }

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

    const members = await this.prisma.accountMember.findMany({
      where: { accountId: tx.accountId },
    });
    const weights = this.buildSignerWeights(members);
    const collected = this.buildCollectedSignatures(tx.signatures);

    if (!isThresholdMet(collected, weights, tx.requiredThreshold)) {
      throw new BadRequestException('threshold not met');
    }

    const signedXdr = combineSignatures(
      tx.xdr,
      collected,
      getNetworkPassphrase(),
    );

    try {
      const result = await submitSignedXdr(signedXdr, {
        networkPassphrase: getNetworkPassphrase(),
      });

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'submitted', submittedHash: result.hash },
      });

      return { hash: result.hash, status: 'submitted' };
    } catch (err) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  async listForAccount(accountId: string): Promise<Transaction[]> {
    const account = await this.prisma.multisigAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const txs = await this.prisma.transaction.findMany({
      where: { accountId },
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

  private async refreshReadyStatus(
    transactionId: string,
    accountId: string,
    requiredThreshold: number,
    currentStatus: PrismaTransaction['status'],
  ): Promise<void> {
    if (currentStatus !== 'pending') {
      return;
    }

    const [signatures, members] = await Promise.all([
      this.prisma.signature.findMany({ where: { transactionId } }),
      this.prisma.accountMember.findMany({ where: { accountId } }),
    ]);

    const weights = this.buildSignerWeights(members);
    const collected = this.buildCollectedSignatures(signatures);

    if (isThresholdMet(collected, weights, requiredThreshold)) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'ready' },
      });
    }
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
      submittedHash: tx.submittedHash,
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
