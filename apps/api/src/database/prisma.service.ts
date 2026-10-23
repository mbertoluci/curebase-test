import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { loadConfig } from '../config/configuration';

/**
 * Redact SQL quoted string literals ('...' incl. escaped '' inside), so a
 * template that somehow inlined a value still cannot leak it. Parameterized
 * templates ($1 placeholders) pass through untouched.
 */
export function scrubSqlLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "'…'");
}

/**
 * Known SQL statement keywords, the single source of truth for the query logger:
 * the allow-list for an operation name we can safely log, and (compiled below) the
 * gate that decides whether a full scrubbed template is safe to log at all.
 */
const SQL_KEYWORDS: readonly string[] = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'WITH',
  'SAVEPOINT',
];

/** A scrubbed template is logged in full only when it starts with a known keyword. */
const SQL_STATEMENT_START = new RegExp(
  `^[(\\s]*(${SQL_KEYWORDS.join('|')})\\b`,
  'i',
);

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
        // Dev-only query diagnostics. `event.params` (the actual values, incl.
        // PII and audit snapshots) is NEVER logged. The SQL template is safe:
        // Postgres prepared statements carry $1 placeholders, not values. Two
        // fail-closed defences: quoted string literals are redacted (an
        // inlined value from a raw-unsafe query cannot leak), and only a
        // template that starts with a known SQL keyword is logged at all -
        // anything else degrades to an allow-listed operation name.
        const scrubbed = scrubSqlLiterals(event.query.trim());
        const operation = scrubbed.split(/\s+/, 1)[0].toUpperCase();
        const safeOperation = SQL_KEYWORDS.includes(operation)
          ? operation
          : 'OTHER';
        const detail = SQL_STATEMENT_START.test(scrubbed)
          ? scrubbed
          : safeOperation;
        this.logger.debug(`Prisma query ${detail} - ${event.duration}ms`);
      });
    }
    // Engine messages may include SQL, parameters or rejected row contents.
    this.$on('warn', () =>
      this.logger.warn(
        'Prisma warning (details omitted to protect sensitive data)',
      ),
    );
    this.$on('error', () =>
      this.logger.error(
        'Prisma error (details omitted to protect sensitive data)',
      ),
    );

    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
