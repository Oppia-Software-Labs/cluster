import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

// PrismaService comes from the global PrismaModule; AuthModule provides the
// JwtAuthGuard used to protect every route on this controller.
@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
