import { Module } from '@nestjs/common';
import { ExistsConstraint } from './exists.constraint';

/**
 * Registers class-validator constraints that need dependency injection (they
 * query the database). `useContainer(...)` in main.ts lets class-validator
 * resolve them from Nest's container.
 */
@Module({
  providers: [ExistsConstraint],
  exports: [ExistsConstraint],
})
export class ValidationModule {}
