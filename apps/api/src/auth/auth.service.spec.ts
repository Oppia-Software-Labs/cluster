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
