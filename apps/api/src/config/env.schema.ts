import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECURE: z.enum(['true', 'false']).transform((v) => v === 'true'),
  STELLAR_NETWORK: z.literal('mainnet'),
  NETWORK_PASSPHRASE: z.string().min(1),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  /** Opt-in testnet path used only by vault_deposit transactions. */
  STELLAR_TESTNET_RPC_URL: z.string().url(),
  /** Server-held DeFindex API key — never sent to the browser. */
  DEFINDEX_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  return result.data;
}
