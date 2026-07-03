import { validateEnv } from './env.schema';

const valid = {
  PORT: '3001',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@host:6543/db?pgbouncer=true',
  DIRECT_URL: 'postgresql://user:pass@host:5432/db',
  JWT_SECRET: 'a-very-long-secret-value-32-characters!',
  COOKIE_SECURE: 'false',
  STELLAR_NETWORK: 'mainnet',
  STELLAR_RPC_URL: 'https://mainnet.sorobanrpc.com',
  STELLAR_HORIZON_URL: 'https://horizon.stellar.org',
  STELLAR_TESTNET_RPC_URL: 'https://soroban-testnet.stellar.org',
  DEFINDEX_API_KEY: 'sk_test_key',
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

  it('accepts a testnet network', () => {
    const parsed = validateEnv({ ...valid, STELLAR_NETWORK: 'testnet' });
    expect(parsed.STELLAR_NETWORK).toBe('testnet');
  });

  it('defaults STELLAR_NETWORK to mainnet when omitted', () => {
    const { STELLAR_NETWORK: _omit, ...withoutNetwork } = valid;
    expect(validateEnv(withoutNetwork).STELLAR_NETWORK).toBe('mainnet');
  });

  it('rejects an unrecognized network', () => {
    expect(() =>
      validateEnv({ ...valid, STELLAR_NETWORK: 'futurenet' }),
    ).toThrow(/STELLAR_NETWORK/);
  });

  it('allows omitting the testnet RPC override', () => {
    const { STELLAR_TESTNET_RPC_URL: _omit, ...withoutOverride } = valid;
    expect(validateEnv(withoutOverride).STELLAR_TESTNET_RPC_URL).toBeUndefined();
  });

  it('leaves the confidential contract IDs undefined when omitted', () => {
    const parsed = validateEnv(valid);
    expect(parsed.CONFIDENTIAL_TOKEN_CONTRACT_ID).toBeUndefined();
    expect(parsed.CONFIDENTIAL_VERIFIER_CONTRACT_ID).toBeUndefined();
    expect(parsed.CONFIDENTIAL_AUDITOR_CONTRACT_ID).toBeUndefined();
    expect(parsed.CONFIDENTIAL_UNDERLYING_SAC).toBeUndefined();
  });

  it('accepts a valid 56-char confidential contract ID when present', () => {
    const contractId = 'C'.repeat(56);
    const parsed = validateEnv({
      ...valid,
      CONFIDENTIAL_TOKEN_CONTRACT_ID: contractId,
    });
    expect(parsed.CONFIDENTIAL_TOKEN_CONTRACT_ID).toBe(contractId);
  });
});
