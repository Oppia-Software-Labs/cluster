import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'degraded';
  message: string;
  db: 'up' | 'down';
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResult> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      message: 'Hello from NestJS 👋',
      db,
    };
  }
}
