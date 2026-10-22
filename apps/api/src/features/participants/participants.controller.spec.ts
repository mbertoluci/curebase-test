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
