import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Integration: needs the docker Postgres up (`npm run db:up`). */
describe('PrismaService (integration)', () => {
  it('connects on module init and disconnects on destroy', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    const rows =
      await service.$queryRawUnsafe<{ one: number }[]>('SELECT 1 as one');
    expect(rows[0].one).toBe(1);
    await service.onModuleDestroy();
  });
});

describe('PrismaService log privacy', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['development', 'production'])(
    'registers safe handlers in %s',
    async (nodeEnv) => {
      jest.replaceProperty(process, 'env', {
        ...process.env,
        NODE_ENV: nodeEnv,
      });
      const service = new PrismaService();
      const on = jest.spyOn(service, '$on').mockReturnThis();
      jest.spyOn(service, '$connect').mockResolvedValue();
      const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      await service.onModuleInit();
      const query = on.mock.calls.find(([kind]) => kind === 'query')?.[1] as
        ((event: Prisma.QueryEvent) => void) | undefined;
      expect(Boolean(query)).toBe(nodeEnv !== 'production');
      if (query) {
        // Parameterized template passes through (placeholders, no literals);
        // an inlined quoted literal is redacted; a bare value (not SQL)
        // degrades to an allow-listed operation - the value never appears.
        // CTE (WITH ...) and SAVEPOINT statements are the shapes Prisma emits
        // for nested writes and interactive transactions; both must log the
        // full scrubbed template, not degrade to OTHER.
        for (const sql of [
          'SELECT "id" FROM "profiles" WHERE email = $1',
          'SELECT "id" FROM "profiles" WHERE email = \'private@example.com\'',
          'private@example.com',
          'WITH "new_row" AS (INSERT INTO "users" VALUES ($1)) SELECT * FROM "new_row"',
          'SAVEPOINT somename',
        ]) {
          query({
            timestamp: new Date(),
            target: 'engine',
            query: sql,
            params: '["private@example.com"]',
            duration: 17,
          });
        }
        expect(debug.mock.calls).toEqual([
          [
            'Prisma query SELECT "id" FROM "profiles" WHERE email = $1 - 17ms',
          ],
          [
            "Prisma query SELECT \"id\" FROM \"profiles\" WHERE email = '…' - 17ms",
          ],
          ['Prisma query OTHER - 17ms'],
          [
            'Prisma query WITH "new_row" AS (INSERT INTO "users" VALUES ($1)) SELECT * FROM "new_row" - 17ms',
          ],
          ['Prisma query SAVEPOINT somename - 17ms'],
        ]);
      }
      const event: Prisma.LogEvent = {
        timestamp: new Date(),
        target: 'engine',
        message: 'Rejected private@example.com',
      };
      for (const kind of ['warn', 'error'] as const) {
        const handler = on.mock.calls.find(([name]) => name === kind)?.[1] as (
          event: Prisma.LogEvent,
        ) => void;
        handler(event);
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(
        JSON.stringify([
          ...debug.mock.calls,
          ...warn.mock.calls,
          ...error.mock.calls,
        ]),
      ).not.toContain('private@example.com');
      await service.onModuleDestroy();
    },
  );
});
