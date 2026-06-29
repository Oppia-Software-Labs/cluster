import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { Keypair, hash } from '@stellar/stellar-sdk';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SEP53_PREFIX = 'Stellar Signed Message:\n';

function signSep53(kp: Keypair, message: string): string {
  const payload = hash(
    Buffer.concat([Buffer.from(SEP53_PREFIX, 'utf8'), Buffer.from(message, 'utf8')]),
  );
  return kp.sign(payload).toString('base64');
}

describe('AuthService.verifySignature (SEP-53)', () => {
  let service: AuthService;
  const prismaMock = { user: { upsert: jest.fn(), findUnique: jest.fn() } };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [AuthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('accepts a genuine SEP-53 signature for the issued challenge', () => {
    const kp = Keypair.random();
    const { message, nonce } = service.createChallenge(kp.publicKey());
    const signature = signSep53(kp, message);
    expect(service.verifyChallenge(kp.publicKey(), signature, nonce)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const kp = Keypair.random();
    const { nonce } = service.createChallenge(kp.publicKey());
    expect(service.verifyChallenge(kp.publicKey(), 'AAAA', nonce)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const kp = Keypair.random();
    const other = Keypair.random();
    const { message, nonce } = service.createChallenge(kp.publicKey());
    const signature = signSep53(other, message);
    expect(service.verifyChallenge(kp.publicKey(), signature, nonce)).toBe(false);
  });

  it('rejects an unknown / already-consumed nonce (replay)', () => {
    const kp = Keypair.random();
    const { message, nonce } = service.createChallenge(kp.publicKey());
    const signature = signSep53(kp, message);
    expect(service.verifyChallenge(kp.publicKey(), signature, nonce)).toBe(true);
    // second use of the same nonce must fail (single-use)
    expect(service.verifyChallenge(kp.publicKey(), signature, nonce)).toBe(false);
  });

  it('rejects an expired nonce', () => {
    jest.useFakeTimers();
    const kp = Keypair.random();
    const { message, nonce } = service.createChallenge(kp.publicKey());
    const signature = signSep53(kp, message);
    jest.advanceTimersByTime(6 * 60 * 1000); // past the 5-min TTL
    expect(service.verifyChallenge(kp.publicKey(), signature, nonce)).toBe(false);
    jest.useRealTimers();
  });
});

describe('AuthService session issuance', () => {
  let service: AuthService;
  const prismaMock = {
    user: {
      upsert: jest.fn().mockResolvedValue({ publicKey: 'G...', createdAt: new Date() }),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [AuthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('upserts the user and returns it', async () => {
    const user = await service.upsertUser('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA');
    expect(prismaMock.user.upsert).toHaveBeenCalled();
    expect(user.publicKey).toBeDefined();
  });

  it('issues a JWT whose payload carries the publicKey as sub', () => {
    const token = service.issueToken('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA');
    const decoded = service.verifyToken(token);
    expect(decoded.sub).toBe('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA');
  });

  it('sets an httpOnly SameSite=Lax session cookie', () => {
    const res = { cookie: jest.fn() } as any;
    service.setSessionCookie(res, 'the.jwt.token');
    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE,
      'the.jwt.token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('clears the session cookie on logout', () => {
    const res = { clearCookie: jest.fn() } as any;
    service.clearSessionCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.objectContaining({ path: '/' }));
  });
});
