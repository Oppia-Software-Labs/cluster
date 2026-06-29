import { verifyAuthSchema, stellarPublicKeySchema } from './auth.schemas';

const G = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA';

describe('auth zod schemas', () => {
  it('accepts a valid Stellar public key (challenge query)', () => {
    expect(stellarPublicKeySchema.safeParse(G).success).toBe(true);
  });

  it('rejects a non-Stellar publicKey (challenge query)', () => {
    expect(stellarPublicKeySchema.safeParse('nope').success).toBe(false);
  });

  it('accepts a valid verify payload', () => {
    const result = verifyAuthSchema.safeParse({
      publicKey: G,
      signature: 'YmFzZTY0c2ln',
      nonce: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a verify payload missing the signature', () => {
    const result = verifyAuthSchema.safeParse({ publicKey: G, nonce: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('rejects a verify payload with a malformed publicKey', () => {
    const result = verifyAuthSchema.safeParse({
      publicKey: 'not-a-key',
      signature: 'YmFzZTY0c2ln',
      nonce: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});
