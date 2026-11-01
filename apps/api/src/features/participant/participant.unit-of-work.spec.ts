import { AuditAction, AuditEntity } from '../../common/audit/audit.repository';
import { ParticipantUnitOfWork } from './participant.unit-of-work';

/**
 * The UoW's job is to open one transaction and bind that single client to every
 * repository operation it exposes, so a use case's participant mutation and its
 * audit row share the transaction. These tests assert exactly that binding.
 */
describe('ParticipantUnitOfWork', () => {
  it('shares one transaction client across participant + audit operations', async () => {
    const client = { tag: 'tx-client' };
    const transactions = {
      run: jest.fn((work: (tx: unknown) => unknown) => work(client)),
    };
    const participants = {
      lockByIdTx: jest.fn().mockResolvedValue(undefined),
      findByIdTx: jest.fn().mockResolvedValue('found'),
      createTx: jest.fn().mockResolvedValue('created'),
      updateTx: jest.fn().mockResolvedValue('updated'),
      softDeleteTx: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };

    const uow = new ParticipantUnitOfWork(
      transactions as never,
      participants as never,
      audit as never,
    );

    const out = await uow.run(async (tx) => {
      await tx.lock('id');
      expect(await tx.findById('id')).toBe('found');
      expect(await tx.create({ email: 'a@b.com' } as never)).toBe('created');
      expect(await tx.update('id', { firstName: 'X' })).toBe('updated');
      await tx.softDelete('id');
      await tx.audit({
        actor: 'tester',
        action: AuditAction.CREATE,
        entity: AuditEntity.PARTICIPANT,
        entityId: 'id',
      });
      return 'done';
    });

    expect(out).toBe('done');
    // every operation received the same transaction client
    expect(participants.lockByIdTx).toHaveBeenCalledWith(client, 'id');
    expect(participants.findByIdTx).toHaveBeenCalledWith(client, 'id');
    expect(participants.createTx).toHaveBeenCalledWith(client, {
      email: 'a@b.com',
    });
    expect(participants.updateTx).toHaveBeenCalledWith(client, 'id', {
      firstName: 'X',
    });
    expect(participants.softDeleteTx).toHaveBeenCalledWith(client, 'id');
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'CREATE' }),
    );
  });
});
