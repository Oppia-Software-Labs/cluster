import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ZOD_SCHEMA } from '../decorators/zod-body.decorator';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!value || typeof value !== 'object') {
      return value;
    }
    const schema = Reflect.getMetadata(ZOD_SCHEMA, value) as
      | ZodTypeAny
      | undefined;
    if (!schema) {
      return value;
    }
    const result = schema.safeParse(value);
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
