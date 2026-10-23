import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionManager } from './transaction-manager';

/**
 * Global so every repository can inject `PrismaService` (and the generic
 * `TransactionManager`) without re-importing. The database is a cross-cutting
 * infrastructure concern, not a feature.
 */
@Global()
@Module({
  providers: [PrismaService, TransactionManager],
  exports: [PrismaService, TransactionManager],
})
export class DatabaseModule {}
