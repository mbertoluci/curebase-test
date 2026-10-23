import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Runs a unit of work inside one database transaction. Generic infrastructure:
 * it knows nothing about any feature; a feature's unit-of-work composes its own
 * repositories inside `work`. This is the only place the transaction mechanism
 * (`$transaction`) lives, so application services never touch Prisma directly.
 */
@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
