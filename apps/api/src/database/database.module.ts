import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every repository can inject `PrismaService` without re-importing.
 * The database is a cross-cutting infrastructure concern, not a feature.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
