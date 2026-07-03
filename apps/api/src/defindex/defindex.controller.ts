import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  buildVaultDepositXdrSchema,
  buildVaultWithdrawXdrSchema,
  type BuildVaultDepositXdrDto,
  type BuildVaultWithdrawXdrDto,
} from '@cluster/shared';
import { ZodBody } from '../common/decorators/zod-body.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DefindexService } from './defindex.service';

@Controller('defindex')
@UseGuards(JwtAuthGuard)
export class DefindexController {
  constructor(private readonly defindex: DefindexService) {}

  @Post('vault/:address/deposit-xdr')
  buildDepositXdr(
    @Param('address') address: string,
    @ZodBody(buildVaultDepositXdrSchema) dto: BuildVaultDepositXdrDto,
  ) {
    return this.defindex.buildDepositXdr(address, dto);
  }

  @Post('vault/:address/withdraw-xdr')
  buildWithdrawXdr(
    @Param('address') address: string,
    @ZodBody(buildVaultWithdrawXdrSchema) dto: BuildVaultWithdrawXdrDto,
  ) {
    return this.defindex.buildWithdrawXdr(address, dto);
  }
}
