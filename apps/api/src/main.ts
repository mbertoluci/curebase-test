import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { APP_CONFIG, AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // bufferLogs so early logs go through pino once it is wired up.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Single typed source of configuration (no ad hoc process.env here).
  const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG);

  // Security headers (nosniff, SAMEORIGIN framing, HSTS, ...). CSP is left off:
  // this is a JSON API and the only HTML it serves is the dev Swagger UI, which
  // needs a relaxed CSP; a browser-facing app would ship a real policy.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix(config.globalPrefix);

  app.enableCors({ origin: config.corsOrigins });

  // Flush Prisma (and other) shutdown hooks on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // OpenAPI docs at /{prefix}/{path} - exposed outside production only, so a
  // deployed instance does not publish its full API surface.
  if (!config.isProduction) {
    const doc = new DocumentBuilder()
      .setTitle(config.swagger.title)
      .setDescription(config.swagger.description)
      .setVersion(config.swagger.version)
      .build();
    SwaggerModule.setup(
      `${config.globalPrefix}/${config.swagger.path}`,
      app,
      SwaggerModule.createDocument(app, doc),
    );
  }

  await app.listen(config.port);
  app
    .get(Logger)
    .log(`API ready on http://localhost:${config.port}/${config.globalPrefix}`);
}

void bootstrap();
