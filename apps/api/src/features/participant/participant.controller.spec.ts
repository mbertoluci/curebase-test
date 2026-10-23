import { VALIDATION_ERROR_DESCRIPTION } from '../../common/api.constants';
import { PaginatedParticipantDto, ParticipantDto } from './participant.dto';
import { ParticipantController } from './participant.controller';
import { ParticipantService } from './participant.service';

describe('ParticipantController', () => {
  const service = {
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    list: jest.fn().mockResolvedValue({ data: [], pageInfo: {} }),
    findById: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new ParticipantController(
    service as unknown as ParticipantService,
  );
  const body = { firstName: 'A' } as never;

  beforeEach(() => jest.clearAllMocks());

  it('create defaults the actor to "anonymous" when no header is sent', async () => {
    await controller.create(body);
    expect(service.create).toHaveBeenCalledWith(body, 'anonymous');
  });

  it('create uses the x-actor-id header (trimmed) when present', async () => {
    await controller.create(body, '  editor  ');
    expect(service.create).toHaveBeenCalledWith(body, 'editor');
  });

  it('list delegates the query to the service', async () => {
    const query = { page: 2 } as never;
    await controller.list(query);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('documents the list response as the { data, pageInfo } envelope, not a bare array', () => {
    // A13 pinned at the source: if this regresses to isArray: true (or drops
    // PaginatedParticipantDto), generated clients go back to expecting a bare
    // array while the service returns the envelope.
    const responses = Reflect.getMetadata(
      'swagger/apiResponse',
      ParticipantController.prototype.list,
    ) as Record<string, { type?: unknown; isArray?: boolean }>;
    const ok = responses['200'];
    expect(ok.isArray).toBeFalsy();
    expect(ok.type).toBe(PaginatedParticipantDto);
  });

  it('documents single-resource responses as ParticipantDto', () => {
    for (const method of ['findById', 'update'] as const) {
      const responses = Reflect.getMetadata(
        'swagger/apiResponse',
        ParticipantController.prototype[method],
      ) as Record<string, { type?: unknown }>;
      expect(responses['200'].type).toBe(ParticipantDto);
    }
  });

  it('documents the VALIDATION_FAILED 400 on every validating route', () => {
    // Pins @ApiValidationErrorResponse: dropping it from any route (or
    // changing the shared description) must fail here, not in generated
    // client contracts downstream.
    const methods = ['create', 'list', 'findById', 'update', 'remove'] as const;
    for (const method of methods) {
      const responses = Reflect.getMetadata(
        'swagger/apiResponse',
        ParticipantController.prototype[method],
      ) as Record<
        string,
        { description?: string; type?: unknown; isArray?: boolean }
      >;
      expect(responses['400']?.description).toBe(VALIDATION_ERROR_DESCRIPTION);
    }
  });

  it('findById delegates the id', async () => {
    await controller.findById('p1');
    expect(service.findById).toHaveBeenCalledWith('p1');
  });

  it('update delegates id, body and actor', async () => {
    await controller.update('p1', body, 'editor');
    expect(service.update).toHaveBeenCalledWith('p1', body, 'editor');
  });

  it('remove delegates id and actor (default anonymous)', async () => {
    await controller.remove('p1');
    expect(service.remove).toHaveBeenCalledWith('p1', 'anonymous');
  });

  it('falls back to anonymous for a blank actor header', async () => {
    await controller.create(body, '   ');
    expect(service.create).toHaveBeenCalledWith(body, 'anonymous');
  });
});
