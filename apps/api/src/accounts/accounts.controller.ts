import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  addAccountMemberRequestSchema,
  createMultisigAccountRequestSchema,
  updateAccountThresholdsRequestSchema,
  type AddAccountMemberRequest,
  type CreateMultisigAccountRequest,
  type UpdateAccountThresholdsRequest,
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

  @Post(':id/members')
  addMember(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @ZodBody(addAccountMemberRequestSchema) dto: AddAccountMemberRequest,
  ) {
    return this.accounts.addMember(id, req.user.publicKey, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.accounts.removeMember(id, req.user.publicKey, memberId);
  }

  @Patch(':id/thresholds')
  updateThresholds(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @ZodBody(updateAccountThresholdsRequestSchema)
    dto: UpdateAccountThresholdsRequest,
  ) {
    return this.accounts.updateThresholds(id, req.user.publicKey, dto);
  }
}
