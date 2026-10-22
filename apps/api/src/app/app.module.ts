import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from '../common/audit/audit.module';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { ValidationModule } from '../common/validation/validation.module';
import { DatabaseModule } from '../database/database.module';
import { ParticipantsModule } from '../features/participants/participants.module';
import { AppController } from './app.controller';

// NODE_ENV is read before ConfigModule.forRoot loads .env, so the launcher
// must set it. ConfigModule loads the remaining .env values into process.env;
// LoggerModule below and bootstrap in main.ts read them directly. This app
// uses ConfigModule for env loading, not ConfigService-based configuration.
const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Never let request headers that may carry secrets reach the logs.
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport: isProduction
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true } },
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
