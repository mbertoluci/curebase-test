import { Global, Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';

// Global like DatabaseModule: auditing is cross-cutting infrastructure every
// feature uses, so it is provided once rather than imported per feature module.
@Global()
@Module({
  providers: [AuditRepository],
  exports: [AuditRepository],
})
export class AuditModule {}
