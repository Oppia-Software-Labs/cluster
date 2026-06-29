import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  type: z.enum(['payment', 'config', 'trade']),
  xdr: z.string().min(1),
});

function bodyMeta(): ArgumentMetadata {
  return {
    type: 'body',
    metatype: undefined,
    data: undefined,
  } as ArgumentMetadata;
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value for a valid payload', () => {
    const value = { type: 'payment', xdr: 'AAAA' };
    expect(pipe.transform(value, bodyMeta())).toEqual(value);
  });

  it('rejects a malformed payload with BadRequestException', () => {
    const value = { type: 'nope', xdr: '' };
    expect(() => pipe.transform(value, bodyMeta())).toThrow(
      BadRequestException,
    );
  });

  it('includes flattened zod issues as details on failure', () => {
    expect.assertions(2);
    try {
      pipe.transform({ type: 'nope', xdr: '' }, bodyMeta());
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        message: string;
        details: { path: string; message: string }[];
      };
      expect(response.message).toBe('Validation failed');
      expect(response.details.length).toBeGreaterThan(0);
    }
  });
});
