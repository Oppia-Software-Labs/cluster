import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssetsService } from './assets.service';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get(':id/balances')
  getBalances(@Param('id') accountId: string) {
    return this.assets.getBalances(accountId);
  }

  @Get(':id/history')
  getHistory(@Param('id') accountId: string) {
    return this.assets.getHistory(accountId);
  }
}
