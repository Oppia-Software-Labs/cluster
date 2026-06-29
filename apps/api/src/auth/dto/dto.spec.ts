import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChallengeQueryDto } from './challenge-query.dto';
import { VerifyAuthDto } from './verify.dto';

const G = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA';

describe('auth DTOs', () => {
  it('accepts a valid challenge query', async () => {
    const dto = plainToInstance(ChallengeQueryDto, { publicKey: G });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-Stellar publicKey in the challenge query', async () => {
    const dto = plainToInstance(ChallengeQueryDto, { publicKey: 'nope' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('accepts a valid verify payload', async () => {
    const dto = plainToInstance(VerifyAuthDto, {
      publicKey: G,
      signature: 'YmFzZTY0c2ln',
      nonce: 'abc123',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a verify payload missing the signature', async () => {
    const dto = plainToInstance(VerifyAuthDto, { publicKey: G, nonce: 'abc123' });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
