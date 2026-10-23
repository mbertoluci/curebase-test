import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { ParticipantController } from './participant.controller';
import { ParticipantRepository } from './participant.repository';
import { ParticipantService } from './participant.service';

@Module({
  imports: [AuditModule],
  controllers: [ParticipantController],
  providers: [ParticipantService, ParticipantRepository],
})
export class ParticipantModule {}
