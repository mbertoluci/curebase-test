import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Paginated, ParticipantView } from '@org/contracts';
import { Throws } from '../../common/errors/throws.decorator';
import {
  CreateParticipantDto,
  ListParticipantsQueryDto,
  PaginatedParticipantsDto,
  ParticipantDto,
  UpdateParticipantDto,
} from './participants.dto';
import {
  EmailAlreadyExistsError,
  ParticipantNotFoundError,
} from './participants.error';
import { ParticipantsService } from './participants.service';

/**
 * HTTP boundary. It only (de)serializes DTOs, derives the actor, and delegates
 * to the service - it never contains business logic. Expected errors are
 * declared with `@Throws`, which also documents them in OpenAPI.
 */
@ApiTags('participants')
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly service: ParticipantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ParticipantDto })
  @Throws(EmailAlreadyExistsError)
  create(
    @Body() body: CreateParticipantDto,
    @Headers('x-actor-id') actor?: string,
  ): Promise<ParticipantView> {
    return this.service.create(body, this.actorOf(actor));
  }

  @Get()
  @ApiOkResponse({ type: PaginatedParticipantsDto })
  list(
    @Query() query: ListParticipantsQueryDto,
  ): Promise<Paginated<ParticipantView>> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ParticipantDto })
  @Throws(ParticipantNotFoundError)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<ParticipantView> {
    return this.service.findById(id);
  }

  @Put(':id')
  @ApiOkResponse({ type: ParticipantDto })
  @Throws(ParticipantNotFoundError, EmailAlreadyExistsError)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateParticipantDto,
    @Headers('x-actor-id') actor?: string,
  ): Promise<ParticipantView> {
    return this.service.update(id, body, this.actorOf(actor));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throws(ParticipantNotFoundError)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-actor-id') actor?: string,
  ): Promise<void> {
    return this.service.remove(id, this.actorOf(actor));
  }

  /** No auth in scope, so the actor is an optional header, defaulting to anonymous. */
  private actorOf(actor?: string): string {
    return actor?.trim() || 'anonymous';
  }
}
