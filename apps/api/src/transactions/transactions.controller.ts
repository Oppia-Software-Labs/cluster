import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  addSignatureSchema,
  proposeTransactionSchema,
  submitTransactionSchema,
  type AddSignatureDto,
  type ProposeTransactionDto,
  type SubmitTransactionDto,
} from '@cluster/shared';
import { ZodBody } from '../common/decorators/zod-body.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

type AuthedRequest = Request & { user: { publicKey: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('accounts/:id/transactions')
  propose(
    @Param('id') accountId: string,
    @ZodBody(proposeTransactionSchema) dto: ProposeTransactionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transactions.propose(accountId, dto, req.user.publicKey);
  }

  @Get('accounts/:id/transactions')
  listForAccount(@Param('id') accountId: string) {
    return this.transactions.listForAccount(accountId);
  }

  @Post('transactions/:id/signatures')
  addSignature(
    @Param('id') transactionId: string,
    @ZodBody(addSignatureSchema) dto: AddSignatureDto,
  ) {
    return this.transactions.addSignature(transactionId, dto);
  }

  @Post('transactions/:id/submit')
  submit(
    @Param('id') transactionId: string,
    @ZodBody(submitTransactionSchema) _dto: SubmitTransactionDto,
  ) {
    return this.transactions.submit(transactionId);
  }

  @Get('transactions/:id')
  getWithSignatures(@Param('id') transactionId: string) {
    return this.transactions.getWithSignatures(transactionId);
  }
}
