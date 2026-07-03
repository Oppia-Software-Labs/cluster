import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AssetsModule } from './assets/assets.module';
import { DefindexModule } from './defindex/defindex.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AccountsModule,
    TransactionsModule,
    AssetsModule,
    DefindexModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
