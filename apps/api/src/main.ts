import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = app.get(ConfigService<Env, true>);

  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
