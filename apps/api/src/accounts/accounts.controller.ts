import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  createMultisigAccountRequestSchema,
  type CreateMultisigAccountRequest,
} from '@cluster/shared';
import { ZodBody } from '../common/decorators/zod-body.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';

type AuthedRequest = Request & { user: { publicKey: string } };

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @ZodBody(createMultisigAccountRequestSchema) dto: CreateMultisigAccountRequest,
  ) {
    return this.accounts.create(req.user.publicKey, dto);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.accounts.listForUser(req.user.publicKey);
  }

  @Get(':id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.accounts.getById(id, req.user.publicKey);
  }

  @Get(':id/members')
  getMembers(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.accounts.getMembers(id, req.user.publicKey);
  }
}
