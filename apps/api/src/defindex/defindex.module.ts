import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefindexController } from './defindex.controller';
import { DefindexService } from './defindex.service';

@Module({
  imports: [AuthModule],
  controllers: [DefindexController],
  providers: [DefindexService],
})
export class DefindexModule {}
