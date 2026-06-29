import { Body, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

export const ZOD_SCHEMA = 'zod:schema';

/**
 * Marks a request body for validation against a @cluster/shared zod schema.
 * The global ZodValidationPipe reads the stamped schema and parses the body.
 * Usage: `@ZodBody(ProposeTransactionSchema) dto: ProposeTransactionDto`
 *
 * Implemented as an inline pipe that stamps the schema as metadata on the
 * incoming body object; the global ZodValidationPipe then reads that metadata
 * and parses. Routes without `@ZodBody` pass through untouched.
 */
export function ZodBody(schema: ZodTypeAny): ParameterDecorator {
  const stampPipe: PipeTransform = {
    transform(value: unknown): unknown {
      if (value && typeof value === 'object') {
        Reflect.defineMetadata(ZOD_SCHEMA, schema, value);
      }
      return value;
    },
  };
  return Body(stampPipe);
}
