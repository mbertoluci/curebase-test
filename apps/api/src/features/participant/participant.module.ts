import { Module } from '@nestjs/common';
import { ParticipantController } from './participant.controller';
import { ParticipantRepository } from './participant.repository';
import { ParticipantService } from './participant.service';
import { ParticipantUnitOfWork } from './participant.unit-of-work';

// AuditModule and DatabaseModule are @Global, so they are not imported here.
@Module({
  controllers: [ParticipantController],
  providers: [ParticipantService, ParticipantRepository, ParticipantUnitOfWork],
})
export class ParticipantModule {}
