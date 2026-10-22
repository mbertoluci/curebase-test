import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { useContainer } from 'class-validator';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  // bufferLogs so early logs go through pino once it is wired up.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const globalPrefix = process.env.API_GLOBAL_PREFIX ?? 'api';
  app.setGlobalPrefix(globalPrefix);

  // Let class-validator resolve DI-backed constraints (e.g. @Exists) from Nest.
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // CORS for the web app(s).
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });

  // Flush Prisma (and other) shutdown hooks on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // OpenAPI docs at /{prefix}/docs.
  const config = new DocumentBuilder()
    .setTitle('Curebase BMI API')
    .setDescription('Participant demographic + health capture with derived BMI')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    `${globalPrefix}/docs`,
    app,
    SwaggerModule.createDocument(app, config),
  );

  // API_PORT (not PORT) so it never collides with Next's own PORT in the monorepo.
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3333);
  await app.listen(port);
  app.get(Logger).log(`API ready on http://localhost:${port}/${globalPrefix}`);
}

void bootstrap();
