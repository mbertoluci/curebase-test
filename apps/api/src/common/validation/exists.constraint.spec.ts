import { ValidationArguments } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { Exists, ExistsConstraint } from './exists.constraint';

describe('ExistsConstraint', () => {
  const findFirst = jest.fn();
  const prisma = { participant: { findFirst } } as unknown as PrismaService;
  const constraint = new ExistsConstraint(prisma);
  const args = {
    constraints: ['participant'],
    value: 'id-1',
  } as unknown as ValidationArguments;

  beforeEach(() => findFirst.mockReset());

  it('passes when a non-deleted row exists and scopes the query to deletedAt: null', async () => {
    findFirst.mockResolvedValue({ id: 'id-1' });
    await expect(constraint.validate('id-1', args)).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'id-1', deletedAt: null },
    });
  });

  it('fails when no active row exists (a soft-deleted tombstone does not count)', async () => {
    findFirst.mockResolvedValue(null);
    await expect(constraint.validate('id-1', args)).resolves.toBe(false);
  });

  it('skips the check for empty values (presence is validated separately)', async () => {
    await expect(constraint.validate(undefined, args)).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('fails when the model is not a known Prisma delegate', async () => {
    const badArgs = {
      constraints: ['nope'],
      value: 'x',
    } as unknown as ValidationArguments;
    await expect(constraint.validate('x', badArgs)).resolves.toBe(false);
  });

  it('builds a helpful default message naming the model and value', () => {
    expect(constraint.defaultMessage(args)).toBe(
      'participant "id-1" does not exist',
    );
  });

  it('registers as a property decorator via Exists()', () => {
    expect(() => {
      class Dummy {
        @Exists('participant')
        participantId!: string;
      }
      return new Dummy();
    }).not.toThrow();
  });
});
