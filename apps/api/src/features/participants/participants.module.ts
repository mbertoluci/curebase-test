import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { ParticipantsController } from './participants.controller';
import { ParticipantsRepository } from './participants.repository';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [AuditModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService, ParticipantsRepository],
})
export class ParticipantsModule {}
