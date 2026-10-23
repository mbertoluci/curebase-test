import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { loadConfig } from '../config/configuration';

/**
 * Owns the Prisma Client lifecycle and is the single database handle injected
 * into repositories. Connecting on module init fails fast if the DB is
 * unreachable; disconnecting on destroy releases the pool cleanly.
 *
 * Observability: outside production the client emits every query as an event
 * and logs it with its duration (debug), so slow queries surface during
 * development without adding any noise to production logs.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly isProduction: boolean;

  constructor() {
    // Read the one centralized config directly (loadConfig is the single source
    // of truth). We avoid injecting ConfigService here so the data layer carries
    // no dependency on @nestjs/config.
    const app = loadConfig();
    super({
      log: [
        ...(app.isProduction
          ? []
          : [{ emit: 'event', level: 'query' } as const]),
        { emit: 'event', level: 'warn' } as const,
        { emit: 'event', level: 'error' } as const,
      ],
    });
    this.isProduction = app.isProduction;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isProduction) {
      this.$on('query', (event) => {
        this.logger.debug(`${event.query} [${event.params}] - ${event.duration}ms`);
      });
    }
    this.$on('warn', (event) => this.logger.warn(event.message));
    this.$on('error', (event) => this.logger.error(event.message));

    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
