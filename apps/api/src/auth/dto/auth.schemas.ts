import { z } from 'zod';

// Stellar ed25519 public keys: 'G' + 55 base32 chars.
export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'publicKey must be a Stellar G... address');

/** Body of POST /auth/verify. */
export const verifyAuthSchema = z.object({
  publicKey: stellarPublicKeySchema,
  signature: z.string().min(1), // base64 ed25519 signature returned by the wallet
  nonce: z.string().min(1),
});

export type VerifyAuthDto = z.infer<typeof verifyAuthSchema>;
