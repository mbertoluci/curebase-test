import { Module } from '@nestjs/common';
import { ParticipantController } from './participant.controller';
import { ParticipantRepository } from './participant.repository';
import { ParticipantService } from './participant.service';

// AuditModule and DatabaseModule are @Global, so they are not imported here.
@Module({
  controllers: [ParticipantController],
  providers: [ParticipantService, ParticipantRepository],
})
export class ParticipantModule {}
