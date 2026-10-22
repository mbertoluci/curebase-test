import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateParticipantDto,
  ListParticipantsQueryDto,
  UpdateParticipantDto,
} from './participants.dto';

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

  it('rejects an explicit null on a required field (never reaches Prisma)', async () => {
    const dto = plainToInstance(UpdateParticipantDto, { firstName: null });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toContain('firstName');
  });

  it('still accepts an explicit null on the nullable phone field', async () => {
    const dto = plainToInstance(UpdateParticipantDto, { phone: null });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('ListParticipantsQueryDto', () => {
  it('coerces numeric query params and validates the sort allow-list', async () => {
    const dto = plainToInstance(ListParticipantsQueryDto, {
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
    const dto = plainToInstance(ListParticipantsQueryDto, { sortBy: 'ssn' });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toContain('sortBy');
  });
});
