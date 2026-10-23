import {
  BmiBand,
  CreateParticipantInput,
  ParticipantView,
  Unit,
} from '@org/contracts';
import { AuditService } from '../../common/audit/audit.service';
import { InputValidationError } from '../../common/errors/validation.error';
import { PrismaService } from '../../database/prisma.service';
import { ParticipantNotFoundError } from './participants.error';
import { ParticipantsRepository } from './participants.repository';
import { ParticipantsService } from './participants.service';

/**
 * Unit tests for the domain layer. The repository, audit and transaction are
 * mocked, so these are fast and assert the *behaviour the service owns*: BMI
 * derivation, the per-unit business rule, recompute-on-update, and not-found.
 */
describe('ParticipantsService', () => {
  let service: ParticipantsService;
  let repository: jest.Mocked<
    Pick<
      ParticipantsRepository,
      | 'createTx'
      | 'updateTx'
      | 'findById'
      | 'findByIdTx'
      | 'softDeleteTx'
      | 'list'
    >
  >;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;

  // A transaction that just runs its callback with a dummy tx client.
  const prisma = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
  } as unknown as PrismaService;

  const view = (over: Partial<ParticipantView> = {}): ParticipantView => ({
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: null,
    weight: 70,
    height: 175,
    unit: Unit.METRIC,
    age: 36,
    bmiValue: 22.86,
    bmiBand: BmiBand.NORMAL,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const validInput: CreateParticipantInput = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    weight: 70,
    height: 175,
    unit: Unit.METRIC,
    age: 36,
  };

  beforeEach(() => {
    repository = {
      createTx: jest.fn().mockResolvedValue(view()),
      updateTx: jest
        .fn()
        .mockResolvedValue(
          view({ weight: 80, bmiValue: 26.12, bmiBand: BmiBand.OVERWEIGHT }),
        ),
      findById: jest.fn(),
      findByIdTx: jest.fn(),
      softDeleteTx: jest.fn(),
      list: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ParticipantsService(
      prisma,
      repository as unknown as ParticipantsRepository,
      audit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it.each([{ weight: 72.249 }, { height: 170.001 }])(
      'rejects excess precision %j before writing',
      async (patch) => {
        await expect(
          service.create({ ...validInput, ...patch }, 'tester'),
        ).rejects.toBeInstanceOf(InputValidationError);
        expect(repository.createTx).not.toHaveBeenCalled();
      },
    );
    it('derives and stores BMI (metric) and writes a CREATE audit row', async () => {
      await service.create(validInput, 'tester');

      const data = repository.createTx.mock.calls[0][1];
      expect(data.bmiValue).toBeCloseTo(22.86, 2); // 70 / 1.75^2
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'CREATE',
          entity: 'participant',
          actor: 'tester',
        }),
      );
    });

    it('rejects implausible measurements before touching the database', async () => {
      await expect(
        service.create({ ...validInput, height: 10 }, 'tester'),
      ).rejects.toBeInstanceOf(InputValidationError);
      expect(repository.createTx).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects excess precision in a partial update', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await expect(
        service.update('p1', { weight: 72.249 }, 'editor'),
      ).rejects.toBeInstanceOf(InputValidationError);
      expect(repository.updateTx).not.toHaveBeenCalled();
    });
    it('recomputes BMI when a measurement changes', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await service.update('p1', { weight: 80 }, 'editor');

      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch.bmiValue).toBeCloseTo(26.12, 2); // 80 / 1.75^2
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'UPDATE',
          before: expect.anything(),
          after: expect.anything(),
        }),
      );
    });

    it('does not recompute BMI when only contact fields change', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await service.update('p1', { phone: '555' }, 'editor');

      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch.bmiValue).toBeUndefined();
    });

    it('passes through every provided contact field (and nulls an empty phone)', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await service.update(
        'p1',
        {
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'grace@example.com',
          phone: null,
        },
        'editor',
      );
      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch).toMatchObject({
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        phone: null,
      });
    });

    it('recomputes from the merged set when only age changes (weight/height from the existing record)', async () => {
      repository.findByIdTx.mockResolvedValue(
        view({ weight: 70, height: 175, unit: Unit.METRIC }),
      );
      await service.update('p1', { age: 50 }, 'editor');
      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch.bmiValue).toBeCloseTo(22.86, 2);
      expect(patch.age).toBe(50);
    });

    it('rejects an update whose merged measurements are implausible', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await expect(
        service.update('p1', { height: 5 }, 'editor'),
      ).rejects.toBeInstanceOf(InputValidationError);
      expect(repository.updateTx).not.toHaveBeenCalled();
    });

    it('throws ParticipantNotFoundError when the row is missing', async () => {
      repository.findByIdTx.mockResolvedValue(null);
      await expect(
        service.update('missing', { phone: '1' }, 'editor'),
      ).rejects.toBeInstanceOf(ParticipantNotFoundError);
    });

    it('requires weight+height when the unit changes (old values are in the old unit)', async () => {
      repository.findByIdTx.mockResolvedValue(view({ unit: Unit.METRIC }));
      await expect(
        service.update('p1', { unit: Unit.US }, 'editor'),
      ).rejects.toBeInstanceOf(InputValidationError);
      await expect(
        service.update('p1', { unit: Unit.US, weight: 154 }, 'editor'),
      ).rejects.toBeInstanceOf(InputValidationError);
      expect(repository.updateTx).not.toHaveBeenCalled();
    });

    it('accepts a unit change when weight and height are both supplied', async () => {
      repository.findByIdTx.mockResolvedValue(view({ unit: Unit.METRIC }));
      await service.update(
        'p1',
        { unit: Unit.US, weight: 154, height: 69 },
        'editor',
      );
      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch.unit).toBe(Unit.US);
      expect(patch.bmiValue).toBeCloseTo(22.74, 1); // 703*154/69^2
    });

    it('merges provided height/unit with the existing weight/age', async () => {
      repository.findByIdTx.mockResolvedValue(
        view({ weight: 60, height: 170, unit: Unit.METRIC, age: 25 }),
      );
      await service.update('p1', { height: 180, unit: Unit.METRIC }, 'editor');
      const patch = repository.updateTx.mock.calls[0][2];
      expect(patch.weight).toBe(60); // from the existing record
      expect(patch.age).toBe(25); // from the existing record
      expect(patch.height).toBe(180);
    });
  });

  describe('findById', () => {
    it('returns the view when found', async () => {
      repository.findById.mockResolvedValue(view());
      await expect(service.findById('p1')).resolves.toMatchObject({ id: 'p1' });
    });

    it('throws ParticipantNotFoundError when missing', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toBeInstanceOf(
        ParticipantNotFoundError,
      );
    });
  });

  describe('list', () => {
    it('applies defaults and computes page info', async () => {
      repository.list.mockResolvedValue({ data: [view()], total: 1 });
      const result = await service.list({});

      expect(repository.list).toHaveBeenCalledWith(
        expect.any(Object),
        { field: 'createdAt', direction: 'desc' },
        { page: 1, pageSize: 25 },
      );
      expect(result.pageInfo).toEqual({
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      });
    });

    it.each([
      { minBmi: 30, maxBmi: 18 },
      { minAge: 60, maxAge: 20 },
    ])('rejects an inverted range %j with a 400', async (query) => {
      await expect(service.list(query)).rejects.toBeInstanceOf(
        InputValidationError,
      );
      expect(repository.list).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws when deleting a missing participant', async () => {
      repository.findByIdTx.mockResolvedValue(null);
      await expect(service.remove('missing', 'editor')).rejects.toBeInstanceOf(
        ParticipantNotFoundError,
      );
      expect(repository.softDeleteTx).not.toHaveBeenCalled();
    });

    it('soft-deletes and writes a DELETE audit row with the before snapshot', async () => {
      repository.findByIdTx.mockResolvedValue(view());
      await service.remove('p1', 'editor');
      expect(repository.softDeleteTx).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'DELETE',
          before: expect.anything(),
        }),
      );
    });
  });
});
