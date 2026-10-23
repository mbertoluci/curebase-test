import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateParticipantDto,
  ListParticipantQueryDto,
  UpdateParticipantDto,
} from './participant.dto';

describe('CreateParticipantDto', () => {
  it('accepts a valid payload and coerces numeric strings', async () => {
    const dto = plainToInstance(CreateParticipantDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '555',
      weight: '80',
      height: '180',
      unit: 'METRIC',
      age: '30',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.weight).toBe(80);
    expect(dto.age).toBe(30);
  });

  it('normalizes the email (trim + lowercase) before validation', async () => {
    const dto = plainToInstance(CreateParticipantDto, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: '  ADA@Example.COM ',
      weight: '80',
      height: '180',
      unit: 'METRIC',
      age: '30',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('ada@example.com');
  });

  it('flags missing name, bad email, non-enum unit and out-of-range age', async () => {
    const dto = plainToInstance(CreateParticipantDto, {
      firstName: '',
      lastName: 'B',
      email: 'not-an-email',
      weight: '80',
      height: '180',
      unit: 'XX',
      age: '200',
    });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining(['firstName', 'email', 'unit', 'age']),
    );
  });
});

describe('UpdateParticipantDto', () => {
  it('accepts a partial patch of only some fields', async () => {
    const dto = plainToInstance(UpdateParticipantDto, { weight: '90' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.weight).toBe(90);
  });

  it('normalizes the email in a partial patch too (PartialType keeps the transform)', async () => {
    // A10/A19 end-to-end: the update path must store the same normalized
    // form the create path and the unique index agree on. If PartialType
    // ever drops the @Transform, an update could persist ' A@X.com ' raw.
    const dto = plainToInstance(UpdateParticipantDto, {
      email: '  ADA@Example.COM ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('ada@example.com');
  });

  it('rejects an explicit null on a required field (never reaches Prisma)', async () => {
    const dto = plainToInstance(UpdateParticipantDto, { firstName: null });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toContain('firstName');
  });

  it('rejects an explicit null on every other required field too', async () => {
    // Each field keeps its own validators when present (skipNullProperties:
    // false), so the guarantee must hold per field, not just for firstName.
    for (const field of ['lastName', 'email', 'age'] as const) {
      const dto = plainToInstance(UpdateParticipantDto, { [field]: null });
      const props = (await validate(dto)).map((e) => e.property);
      expect(props).toContain(field);
    }
  });

  it('still accepts an explicit null on the nullable phone field', async () => {
    const dto = plainToInstance(UpdateParticipantDto, { phone: null });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('ListParticipantQueryDto', () => {
  it('coerces numeric query params and validates the sort allow-list', async () => {
    const dto = plainToInstance(ListParticipantQueryDto, {
      page: '2',
      pageSize: '10',
      minBmi: '18.5',
      sortBy: 'bmiValue',
      sortDir: 'asc',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.minBmi).toBe(18.5);
  });

  it('rejects a sort field outside the allow-list', async () => {
    const dto = plainToInstance(ListParticipantQueryDto, { sortBy: 'ssn' });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toContain('sortBy');
  });
});
