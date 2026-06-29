import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

/**
 * Validates a value against a zod schema supplied at construction time.
 * Bound per-parameter via `@ZodBody(schema)` so it runs with the schema
 * available at transform time. On failure it throws `BadRequestException`
 * with the flattened zod issues as `details`, which the global
 * `HttpExceptionFilter` formats into the standard error envelope.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
