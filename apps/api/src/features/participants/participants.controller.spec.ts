import {
  PaginatedParticipantsDto,
  ParticipantDto,
} from './participants.dto';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

describe('ParticipantsController', () => {
  const service = {
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    list: jest.fn().mockResolvedValue({ data: [], pageInfo: {} }),
    findById: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new ParticipantsController(
    service as unknown as ParticipantsService,
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
    // PaginatedParticipantsDto), generated clients go back to expecting a bare
    // array while the service returns the envelope.
    const responses = Reflect.getMetadata(
      'swagger/apiResponse',
      ParticipantsController.prototype.list,
    ) as Record<string, { type?: unknown; isArray?: boolean }>;
    const ok = responses['200'];
    expect(ok.isArray).toBeFalsy();
    expect(ok.type).toBe(PaginatedParticipantsDto);
  });

  it('documents single-resource responses as ParticipantDto', () => {
    for (const method of ['findById', 'update'] as const) {
      const responses = Reflect.getMetadata(
        'swagger/apiResponse',
        ParticipantsController.prototype[method],
      ) as Record<string, { type?: unknown }>;
      expect(responses['200'].type).toBe(ParticipantDto);
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
