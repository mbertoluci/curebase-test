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
