import { validateEnv } from './env.schema';

const valid = {
  PORT: '3001',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@host:6543/db?pgbouncer=true',
  DIRECT_URL: 'postgresql://user:pass@host:5432/db',
  JWT_SECRET: 'a-very-long-secret-value-32-characters!',
  COOKIE_SECURE: 'false',
  STELLAR_NETWORK: 'mainnet',
  NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
  STELLAR_RPC_URL: 'https://mainnet.sorobanrpc.com',
  STELLAR_HORIZON_URL: 'https://horizon.stellar.org',
};

describe('validateEnv', () => {
  it('accepts a complete, valid env', () => {
    const parsed = validateEnv(valid);
    expect(parsed.PORT).toBe(3001);
    expect(parsed.STELLAR_NETWORK).toBe('mainnet');
    expect(parsed.COOKIE_SECURE).toBe(false);
  });

  it('throws when a required var is missing', () => {
    const { DATABASE_URL: _omit, ...incomplete } = valid;
    expect(() => validateEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-mainnet network', () => {
    expect(() =>
      validateEnv({ ...valid, STELLAR_NETWORK: 'testnet' }),
    ).toThrow(/STELLAR_NETWORK/);
  });
});
