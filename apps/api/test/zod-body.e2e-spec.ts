import { Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { z } from 'zod';
import { ZodBody } from '../src/common/decorators/zod-body.decorator';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const widgetSchema = z.object({
  type: z.enum(['payment', 'config', 'trade']),
  xdr: z.string().min(1),
});

type Widget = z.infer<typeof widgetSchema>;

@Controller('widgets')
class WidgetsTestController {
  @Post()
  create(@ZodBody(widgetSchema) body: Widget): { ok: true; body: Widget } {
    return { ok: true, body };
  }
}

describe('ZodBody runtime validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WidgetsTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid body with a 400 error envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/widgets')
      .send({ type: 'nope', xdr: '' })
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        path: '/widgets',
        message: 'Validation failed',
      }),
    );
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('accepts a valid body and passes the parsed value through', async () => {
    const res = await request(app.getHttpServer())
      .post('/widgets')
      .send({ type: 'payment', xdr: 'AAAA' })
      .expect(201);

    expect(res.body).toEqual({
      ok: true,
      body: { type: 'payment', xdr: 'AAAA' },
    });
  });
});
