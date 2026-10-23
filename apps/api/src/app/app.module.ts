import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from '../common/audit/audit.module';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { ValidationModule } from '../common/validation/validation.module';
import { APP_CONFIG, AppConfig, loadConfig } from '../config/configuration';
import { serializeRequest } from './request-serializer';
import { DatabaseModule } from '../database/database.module';
import { ParticipantsModule } from '../features/participants/participants.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // The one place env is read; everything else takes typed values from here.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({ [APP_CONFIG]: loadConfig() })],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.getOrThrow<AppConfig>(APP_CONFIG);
        return {
          pinoHttp: {
            level: app.logLevel,
            // Log only id + method + path for each request (the A17 PII
            // boundary). The default serializer would log the full URL (query
            // strings carry PII like ?search=<email>) and all request headers.
            serializers: { req: serializeRequest },
            // Defence in depth in case any other log path touches these headers.
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            transport: app.isProduction
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
          },
        };
      },
    }),
    DatabaseModule,
    AuditModule,
    ValidationModule,
    ParticipantsModule,
  ],
  controllers: [AppController],
  providers: [
    // One global pipe: strip unknown fields, reject extras, coerce declared types.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    // One global filter: every error leaves through the same envelope.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
