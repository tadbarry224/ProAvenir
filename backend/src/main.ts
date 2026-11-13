import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = app
    .get<ConfigService<EnvironmentVariables, true>>(ConfigService)
    .get('PORT', {
      infer: true,
    });
  await app.listen(port);
  Logger.log(
    `API ProAvenir prête : http://localhost:${port}/api/health`,
    'Bootstrap',
  );
}
await bootstrap();
