import { Body } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/**
 * Validates a request body against a @cluster/shared zod schema.
 * Binds a `ZodValidationPipe` constructed with the schema to the parameter,
 * so the body is parsed at request time. Routes without `@ZodBody` are
 * unaffected (no global pipe).
 * Usage: `@ZodBody(ProposeTransactionSchema) dto: ProposeTransactionDto`
 */
export function ZodBody(schema: ZodTypeAny): ParameterDecorator {
  return Body(new ZodValidationPipe(schema));
}
