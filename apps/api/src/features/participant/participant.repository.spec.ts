import { computeBmi, roundBmi, Unit } from '@org/contracts';
import {
  AuditEntity,
  AuditRepository,
} from '../../common/audit/audit.repository';
import { TransactionManager } from '../../database/transaction-manager';
import { PrismaService } from '../../database/prisma.service';
import {
  EmailAlreadyExistsError,
  ParticipantNotFoundError,
} from './participant.error';
import { ParticipantRepository } from './participant.repository';
import { ParticipantUnitOfWork } from './participant.unit-of-work';
import { CreateParticipantData } from './participant.type';

/**
 * Integration tests - they run against the real Postgres (docker-compose).
 * Prereq: `npm run db:up && npm run db:migrate`. The suite TRUNCATEs the tables
 * between tests, so point it at a throwaway database (the dev DB is fine).
 * assertLocalTestDatabase() blocks directly configured non-local hosts. It
 * cannot distinguish a local database from a tunnel to a remote database.
 */
function assertLocalTestDatabase(databaseUrl = process.env.DATABASE_URL): void {
  let host: string;
  try {
    host = new URL(databaseUrl ?? '').hostname;
  } catch {
    throw new Error(
      'DATABASE_URL is unset or invalid; refusing to run destructive tests.',
    );
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    throw new Error(
      `Refusing to TRUNCATE against non-local host "${host}". ` +
        'Point DATABASE_URL at a local throwaway database.',
    );
  }
}

describe('destructive-test database guard', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'allows local host %s',
    (host) => {
      expect(() =>
        assertLocalTestDatabase(`postgresql://user:pass@${host}:5433/test`),
      ).not.toThrow();
    },
  );

  it.each(['db.example.com', '192.0.2.1', 'localhost.example.com'])(
    'blocks remote host %s',
    (host) => {
      expect(() =>
        assertLocalTestDatabase(`postgresql://user:pass@${host}:5433/test`),
      ).toThrow(/non-local host/);
    },
  );

  it.each(['', 'not-a-url'])('blocks missing or malformed URL %j', (url) => {
    expect(() => assertLocalTestDatabase(url)).toThrow(/unset or invalid/);
  });
});

describe('ParticipantRepository (integration)', () => {
  const prisma = new PrismaService();
  const repo = new ParticipantRepository(prisma);
  const uow = new ParticipantUnitOfWork(
    new TransactionManager(prisma),
    repo,
    new AuditRepository(),
  );

  const data = (
    over: Partial<CreateParticipantData> = {},
  ): CreateParticipantData => {
    const weight = over.weight ?? 70;
    const height = over.height ?? 175;
    const unit = over.unit ?? Unit.METRIC;
    const age = over.age ?? 30;
    return {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: `ada-${Math.random().toString(36).slice(2)}@example.com`,
      phone: null,
      weight,
      height,
      unit,
      age,
      bmiValue: roundBmi(computeBmi(weight, height, unit), 2),
      ...over,
    };
  };

  const create = (over: Partial<CreateParticipantData> = {}) =>
    prisma.$transaction((tx) => repo.createTx(tx, data(over)));

  it('rolls the whole unit of work back when the audit write fails (atomicity)', async () => {
    // Independent end-to-end proof: run the REAL UoW (manager + repos + tx)
    // where the audit row violates the DB CHECK after the participant was
    // already created - everything must roll back, nothing may remain.
    const payload = data({ email: 'rollback-probe@x.com' });
    await expect(
      uow.run(async (tx) => {
        await tx.create(payload);
        await tx.audit({
          actor: 'qa',
          // Bypasses the TS enum on purpose: the DB CHECK must be the wall.
          action: 'BOGUS' as never,
          entity: AuditEntity.PARTICIPANT,
          entityId: '00000000-0000-0000-0000-000000000000',
        });
      }),
    ).rejects.toThrow();
    // The participant/profile/user inserts from the same tx are gone.
    const leftovers = await prisma.profile.count({
      where: { email: 'rollback-probe@x.com' },
    });
    expect(leftovers).toBe(0);
    const page = await repo.list(
      { search: 'rollback-probe' },
      { field: 'createdAt', direction: 'desc' },
      { page: 1, pageSize: 25 },
    );
    expect(page.total).toBe(0);
    // And no orphan audit row survived either.
    expect(await prisma.auditLog.count()).toBe(0);
  });

  beforeAll(async () => {
    assertLocalTestDatabase();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "audit_logs","participants","profiles","users" RESTART IDENTITY CASCADE',
    );
  });

  it('creates the aggregate and maps the entity to a view (Decimal->number, derived band)', async () => {
    const view = await create({
      email: 'peter@x.com',
      weight: 195,
      height: 70,
      unit: Unit.US,
      age: 42,
    });
    expect(view).toMatchObject({
      email: 'peter@x.com',
      weight: 195,
      height: 70,
      unit: Unit.US,
      age: 42,
      bmiBand: 'OVERWEIGHT',
    });
    expect(view.bmiValue).toBeCloseTo(28, 1);
    expect(new Date(view.createdAt).toISOString()).toBe(view.createdAt);

    const fetched = await repo.findById(view.id);
    expect(fetched).toEqual(view);
  });

  it('stores a valid-but-extreme BMI that would overflow Decimal(5,2)', async () => {
    // 500 kg / 50 cm are each within the plausibility bounds; their BMI is 2000,
    // which needs Decimal(6,2). This used to overflow and 500 at write time.
    const view = await create({
      email: 'extreme@x.com',
      weight: 500,
      height: 50,
      unit: Unit.METRIC,
      age: 30,
    });
    expect(view.bmiValue).toBeCloseTo(2000, 1);
    const fetched = await repo.findById(view.id);
    expect(fetched?.bmiValue).toBeCloseTo(2000, 1);
  });

  it('persists an explicit phone:null update (clears the stored phone)', async () => {
    // The DTO accepts phone:null; this pins that it survives the nested
    // profile update and actually lands as SQL NULL, not as an ignored field.
    const view = await create({ email: 'phone@x.com', phone: '555-0100' });
    expect(view.phone).toBe('555-0100');
    await prisma.$transaction((tx) =>
      repo.updateTx(tx, view.id, { phone: null }),
    );
    const fetched = await repo.findById(view.id);
    expect(fetched?.phone).toBeNull();
  });

  it('derives the band from the unrounded BMI, not the stored 2-decimal value', async () => {
    // 72.24 kg / 170 cm -> BMI 24.9965, stored as 25.00. Classifying the stored
    // value would say OVERWEIGHT; the band must follow the raw value: NORMAL.
    const view = await create({
      email: 'boundary@x.com',
      weight: 72.24,
      height: 170,
      unit: Unit.METRIC,
      age: 30,
    });
    expect(view.bmiValue).toBe(25);
    expect(view.bmiBand).toBe('NORMAL');
    expect((await repo.findById(view.id))?.bmiBand).toBe('NORMAL');
    // Numeric filtering deliberately uses the stored BMI, not category membership.
    const page = await repo.list(
      { minBmi: 25 },
      { field: 'bmiValue', direction: 'asc' },
      { page: 1, pageSize: 25 },
    );
    expect(page.data.map((p) => p.id)).toContain(view.id);

    const overweight = await create({
      weight: 72.25,
      height: 170,
      unit: Unit.METRIC,
      age: 30,
    });
    expect(overweight.bmiBand).toBe('OVERWEIGHT');
    const filtered = await repo.list(
      { minBmi: 25 },
      { field: 'bmiValue', direction: 'asc' },
      { page: 1, pageSize: 25 },
    );
    expect(filtered.data.map((p) => p.id)).toContain(overweight.id);
  });

  it('rejects a duplicate active email via the partial unique index', async () => {
    await create({ email: 'dupe@x.com' });
    await expect(create({ email: 'dupe@x.com' })).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('soft-deletes the aggregate, hides it, and frees the email for re-use', async () => {
    const view = await create({ email: 'gone@x.com' });
    await prisma.$transaction((tx) => repo.softDeleteTx(tx, view.id));

    expect(await repo.findById(view.id)).toBeNull();
    await expect(create({ email: 'gone@x.com' })).resolves.toBeDefined();
  });

  it('updates contact + measurement fields and recomputes nothing it is not given', async () => {
    const view = await create({ weight: 70, height: 175, unit: Unit.METRIC });
    const newBmi = roundBmi(computeBmi(80, 175, Unit.METRIC), 2);
    const updated = await prisma.$transaction((tx) =>
      repo.updateTx(tx, view.id, {
        lastName: 'Byron',
        weight: 80,
        bmiValue: newBmi,
      }),
    );
    expect(updated.lastName).toBe('Byron');
    expect(updated.weight).toBe(80);
    expect(updated.bmiValue).toBe(newBmi);
    expect(updated.firstName).toBe('Ada'); // untouched
  });

  it('propagates a non-unique DB error (e.g. updating a missing row) unchanged', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    await expect(
      prisma.$transaction((tx) =>
        repo.updateTx(tx, missingId, { lastName: 'X' }),
      ),
    ).rejects.not.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('rejects legacy case and whitespace variants through the database index', async () => {
    await create({ email: '  LEGACY@X.COM  ' });
    await expect(create({ email: 'legacy@x.com' })).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('rejects an active participant whose profile is deleted or missing', async () => {
    const view = await create();
    const row = await prisma.participant.findUniqueOrThrow({
      where: { id: view.id },
    });
    await prisma.profile.update({
      where: { userId: row.userId },
      data: { deletedAt: new Date() },
    });
    await expect(repo.findById(view.id)).rejects.toThrow(/no active profile/);
    await prisma.profile.delete({ where: { userId: row.userId } });
    await expect(repo.findById(view.id)).rejects.toThrow(/no active profile/);
  });

  it('does not update a deleted participant', async () => {
    const view = await create();
    await prisma.$transaction((tx) => repo.softDeleteTx(tx, view.id));
    await expect(
      prisma.$transaction((tx) => repo.updateTx(tx, view.id, { weight: 90 })),
    ).rejects.toBeInstanceOf(ParticipantNotFoundError);
    expect(
      (
        await prisma.participant.findUniqueOrThrow({ where: { id: view.id } })
      ).weight.toNumber(),
    ).toBe(view.weight);
  });

  it('consistently hides a deleted user in direct and filtered reads', async () => {
    const view = await create();
    await prisma.user.updateMany({
      where: { participant: { id: view.id } },
      data: { deletedAt: new Date() },
    });
    expect(await repo.findById(view.id)).toBeNull();
    for (const filter of [{}, { search: view.email }]) {
      expect(
        (
          await repo.list(
            filter,
            { field: 'age', direction: 'asc' },
            { page: 1, pageSize: 25 },
          )
        ).total,
      ).toBe(0);
    }
  });

  it.each(['createdAt', 'bmiValue', 'age', 'lastName'] as const)(
    'keeps ascending id ties across pages for %s in either direction',
    async (field) => {
      const tied = await Promise.all([create(), create(), create()]);
      await prisma.participant.updateMany({
        where: { id: { in: tied.map((p) => p.id) } },
        data: { createdAt: new Date('2026-01-01') },
      });
      const greater = await create({
        lastName: 'Zebra',
        age: 50,
        bmiValue: 35,
      });
      await prisma.participant.update({
        where: { id: greater.id },
        data: { createdAt: new Date('2026-02-01') },
      });
      const ids = tied.map((p) => p.id).sort();
      for (const direction of ['asc', 'desc'] as const) {
        const first = await repo.list(
          {},
          { field, direction },
          { page: 1, pageSize: 2 },
        );
        const second = await repo.list(
          {},
          { field, direction },
          { page: 2, pageSize: 2 },
        );
        expect([...first.data, ...second.data].map((p) => p.id)).toEqual(
          direction === 'asc' ? [...ids, greater.id] : [greater.id, ...ids],
        );
      }
    },
  );

  describe('list', () => {
    beforeEach(async () => {
      await create({
        lastName: 'Alpha',
        email: 'a@x.com',
        unit: Unit.US,
        weight: 120,
        height: 60,
        age: 20,
      }); // bmi ~23.4
      await create({
        lastName: 'Bravo',
        email: 'b@x.com',
        unit: Unit.METRIC,
        weight: 95,
        height: 170,
        age: 40,
      }); // bmi ~32.9
      await create({
        lastName: 'Charlie',
        email: 'c@x.com',
        unit: Unit.METRIC,
        weight: 55,
        height: 175,
        age: 30,
      }); // bmi ~18
    });

    it('returns all active rows with a total', async () => {
      const { data: rows, total } = await repo.list(
        {},
        { field: 'createdAt', direction: 'desc' },
        { page: 1, pageSize: 25 },
      );
      expect(total).toBe(3);
      expect(rows).toHaveLength(3);
    });

    it('filters by unit', async () => {
      const { total } = await repo.list(
        { unit: Unit.METRIC },
        { field: 'createdAt', direction: 'desc' },
        { page: 1, pageSize: 25 },
      );
      expect(total).toBe(2);
    });

    it('filters by BMI range', async () => {
      const { data: rows } = await repo.list(
        { minBmi: 30 },
        { field: 'bmiValue', direction: 'asc' },
        { page: 1, pageSize: 25 },
      );
      expect(rows.map((r) => r.lastName)).toEqual(['Bravo']);
    });

    it('filters by age range', async () => {
      const { data: rows } = await repo.list(
        { minAge: 25, maxAge: 35 },
        { field: 'age', direction: 'asc' },
        { page: 1, pageSize: 25 },
      );
      expect(rows.map((r) => r.lastName)).toEqual(['Charlie']); // age 30
    });

    it('searches by name/email (case-insensitive)', async () => {
      const { data: rows } = await repo.list(
        { search: 'BRAVO' },
        { field: 'createdAt', direction: 'desc' },
        { page: 1, pageSize: 25 },
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('b@x.com');
    });

    it('sorts by last name ascending', async () => {
      const { data: rows } = await repo.list(
        {},
        { field: 'lastName', direction: 'asc' },
        { page: 1, pageSize: 25 },
      );
      expect(rows.map((r) => r.lastName)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
    });

    it('paginates', async () => {
      const page1 = await repo.list(
        {},
        { field: 'lastName', direction: 'asc' },
        { page: 1, pageSize: 2 },
      );
      const page2 = await repo.list(
        {},
        { field: 'lastName', direction: 'asc' },
        { page: 2, pageSize: 2 },
      );
      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(1);
      expect(page2.total).toBe(3);
    });

    it('paginates completely when the sort key ties (id tie-break: no skip/repeat)', async () => {
      // Three more rows share one age, so only the id tie-break gives them a
      // stable order. Walk every row one page at a time: each must appear exactly
      // once - without the tie-break a tied row can repeat or vanish across pages.
      for (const name of ['Delta', 'Echo', 'Foxtrot']) {
        await create({
          lastName: name,
          email: `${name.toLowerCase()}@x.com`,
          unit: Unit.METRIC,
          weight: 70,
          height: 175,
          age: 50,
        });
      }
      const sort = { field: 'age' as const, direction: 'asc' as const };
      const seen: string[] = [];
      for (let page = 1; page <= 6; page++) {
        const { data } = await repo.list({}, sort, { page, pageSize: 1 });
        for (const row of data) seen.push(row.id);
      }
      expect(seen).toHaveLength(6); // all six rows, none skipped
      expect(new Set(seen).size).toBe(6); // each exactly once, none repeated
    });
  });
});
