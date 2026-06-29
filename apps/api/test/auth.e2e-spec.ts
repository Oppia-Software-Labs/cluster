import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { Keypair, hash } from '@stellar/stellar-sdk';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const SEP53_PREFIX = 'Stellar Signed Message:\n';
function signSep53(kp: Keypair, message: string): string {
  const payload = hash(
    Buffer.concat([Buffer.from(SEP53_PREFIX, 'utf8'), Buffer.from(message, 'utf8')]),
  );
  return kp.sign(payload).toString('base64');
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const kp = Keypair.random();
  const userRow = { publicKey: kp.publicKey(), createdAt: new Date() };
  const prismaMock = {
    user: {
      upsert: jest.fn().mockResolvedValue(userRow),
      findUnique: jest.fn().mockResolvedValue(userRow),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-secret';
    // PrismaModule is @Global() and exports PrismaService; importing it makes
    // PrismaService resolvable inside AuthModule, and lets us override it with a
    // DB-free mock for the e2e run.
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, AuthModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    // Mirror production (main.ts): cookie-parser + the global HttpExceptionFilter,
    // and NO global ValidationPipe. Request validation runs only via the per-route
    // zod pipes (@ZodBody / @Query(ZodValidationPipe)), exactly as in production.
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs challenge -> verify (sets cookie) -> me -> logout', async () => {
    const challengeRes = await request(app.getHttpServer())
      .get('/auth/challenge')
      .query({ publicKey: kp.publicKey() })
      .expect(200);
    const { message, nonce } = challengeRes.body;
    expect(message).toContain(kp.publicKey());

    const signature = signSep53(kp, message);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ publicKey: kp.publicKey(), signature, nonce })
      .expect(201);
    const setCookie = verifyRes.headers['set-cookie'];
    expect(setCookie[0]).toMatch(/cluster_session=/);
    expect(setCookie[0]).toMatch(/HttpOnly/i);
    expect(setCookie[0]).toMatch(/SameSite=Lax/i);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', setCookie)
      .expect(200)
      .expect((r) => expect(r.body.publicKey).toBe(kp.publicKey()));

    await request(app.getHttpServer()).get('/auth/me').expect(401); // no cookie

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', setCookie)
      .expect(201)
      .expect((r) => expect(r.headers['set-cookie'][0]).toMatch(/cluster_session=;/));
  });

  it('rejects POST /auth/verify with a malformed body (zod 400 envelope)', async () => {
    // Bad publicKey + missing nonce: the per-route @ZodBody pipe must reject
    // this before any handler logic runs, producing the HttpExceptionFilter envelope.
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ publicKey: 'not-a-stellar-key', signature: 'AAAA' })
      .expect(400);
    expect(res.body).toEqual(
      expect.objectContaining({ statusCode: 400, message: 'Validation failed' }),
    );
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('rejects GET /auth/challenge with a bad publicKey (zod 400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/challenge')
      .query({ publicKey: 'nope' })
      .expect(400);
    expect(res.body).toEqual(
      expect.objectContaining({ statusCode: 400, message: 'Validation failed' }),
    );
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('rejects verify with a replayed nonce', async () => {
    const challengeRes = await request(app.getHttpServer())
      .get('/auth/challenge')
      .query({ publicKey: kp.publicKey() });
    const { message, nonce } = challengeRes.body;
    const signature = signSep53(kp, message);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ publicKey: kp.publicKey(), signature, nonce })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ publicKey: kp.publicKey(), signature, nonce })
      .expect(401); // nonce already consumed
  });
});
