import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Keypair, StrKey, hash } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';

const SEP53_PREFIX = 'Stellar Signed Message:\n';
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const SESSION_COOKIE = 'cluster_session';

type ChallengeEntry = { publicKey: string; message: string; expiresAt: number };

@Injectable()
export class AuthService {
  // In-memory nonce store. Single API instance for M1; swap for Redis when horizontally scaled.
  private readonly challenges = new Map<string, ChallengeEntry>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Build a one-time challenge message bound to a nonce, stored with a short TTL. */
  createChallenge(publicKey: string): { message: string; nonce: string } {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new UnauthorizedException('Invalid Stellar public key');
    }
    const nonce = randomBytes(32).toString('hex');
    const message =
      `Cluster authentication\n` +
      `Sign this message to prove you control ${publicKey}.\n` +
      `Nonce: ${nonce}`;
    this.challenges.set(nonce, { publicKey, message, expiresAt: Date.now() + NONCE_TTL_MS });
    return { message, nonce };
  }

  /** Verify a SEP-53 signature for a previously issued, unexpired, unconsumed nonce. Single-use. */
  verifyChallenge(publicKey: string, signatureBase64: string, nonce: string): boolean {
    const entry = this.challenges.get(nonce);
    if (!entry) return false; // unknown or already consumed (replay)
    // Always consume first so a replay of the same nonce can never succeed.
    this.challenges.delete(nonce);
    if (entry.publicKey !== publicKey) return false;
    if (Date.now() > entry.expiresAt) return false;
    if (!StrKey.isValidEd25519PublicKey(publicKey)) return false;
    try {
      const payload = hash(
        Buffer.concat([
          Buffer.from(SEP53_PREFIX, 'utf8'),
          Buffer.from(entry.message, 'utf8'),
        ]),
      );
      const signature = Buffer.from(signatureBase64, 'base64');
      return Keypair.fromPublicKey(publicKey).verify(payload, signature);
    } catch {
      return false;
    }
  }
}
