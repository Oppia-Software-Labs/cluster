import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfidentialController } from './confidential.controller';
import { ConfidentialService } from './confidential.service';

// PrismaService comes from the global PrismaModule; AuthModule provides the
// JwtAuthGuard used to protect every route on this controller.
@Module({
  imports: [AuthModule],
  controllers: [ConfidentialController],
  providers: [ConfidentialService],
  exports: [ConfidentialService],
})
export class ConfidentialModule {}
