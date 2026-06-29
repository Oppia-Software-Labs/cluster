import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// Provide the full §1.4 mainnet-only env matrix with dummy-but-valid values so
// ConfigModule's zod validation passes at boot. The PrismaService override
// below prevents any real DB connection.
const TEST_ENV: Record<string, string> = {
  PORT: '3001',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:6543/postgres?pgbouncer=true',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/postgres',
  JWT_SECRET: 'a-very-long-secret-value-32-characters!',
  COOKIE_SECURE: 'false',
  STELLAR_NETWORK: 'mainnet',
  NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
  STELLAR_RPC_URL: 'https://mainnet.sorobanrpc.com',
  STELLAR_HORIZON_URL: 'https://horizon.stellar.org',
};

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, TEST_ENV);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok with db up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'ok', db: 'up' }),
    );
  });
});
