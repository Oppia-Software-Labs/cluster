import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZOD_SCHEMA } from '../decorators/zod-body.decorator';
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
  const pipe = new ZodValidationPipe();

  it('passes a value through unchanged when no schema is attached', () => {
    const value = { anything: true };
    expect(pipe.transform(value, bodyMeta())).toBe(value);
  });

  it('accepts a valid payload', () => {
    const value = { type: 'payment', xdr: 'AAAA' };
    Reflect.defineMetadata(ZOD_SCHEMA, schema, value);
    expect(pipe.transform(value, bodyMeta())).toEqual(value);
  });

  it('rejects a malformed payload with BadRequestException', () => {
    const value = { type: 'nope', xdr: '' };
    Reflect.defineMetadata(ZOD_SCHEMA, schema, value);
    expect(() => pipe.transform(value, bodyMeta())).toThrow(
      BadRequestException,
    );
  });
});
