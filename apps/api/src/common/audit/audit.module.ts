import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Global like DatabaseModule: auditing is cross-cutting infrastructure every
// feature uses, so it is provided once rather than imported per feature module.
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
