import { Prisma } from '@prisma/client';
import {
  AuditAction,
  AuditEntity,
  AuditRepository,
} from './audit.repository';

describe('AuditRepository', () => {
  const create = jest.fn();
  const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;
  const service = new AuditRepository();

  beforeEach(() => create.mockReset());

  it('writes an audit row with before/after on the given transaction', async () => {
    await service.record(tx, {
      actor: 'editor',
      action: AuditAction.UPDATE,
      entity: AuditEntity.PARTICIPANT,
      entityId: 'p1',
      before: { a: 1 },
      after: { a: 2 },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor: 'editor',
        action: 'UPDATE',
        entity: 'participant',
        entityId: 'p1',
        before: { a: 1 },
        after: { a: 2 },
      }),
    });
  });

  it('stores SQL NULL (DbNull) when before/after are absent (e.g. CREATE/DELETE)', async () => {
    await service.record(tx, {
      actor: 'x',
      action: AuditAction.CREATE,
      entity: AuditEntity.PARTICIPANT,
      entityId: 'p1',
      after: { a: 1 },
    });
    const data = create.mock.calls[0][0].data;
    expect(data.before).toBe(Prisma.DbNull);
    expect(data.after).toEqual({ a: 1 });
  });
});
