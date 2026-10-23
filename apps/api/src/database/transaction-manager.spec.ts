import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TransactionManager } from './transaction-manager';

describe('TransactionManager', () => {
  it('runs the work inside a single prisma.$transaction and returns its result', async () => {
    const txClient = {} as Prisma.TransactionClient;
    const prisma = {
      $transaction: jest.fn((work: (tx: Prisma.TransactionClient) => unknown) =>
        work(txClient),
      ),
    } as unknown as PrismaService;

    const manager = new TransactionManager(prisma);
    const seen: Prisma.TransactionClient[] = [];
    const result = await manager.run(async (tx) => {
      seen.push(tx);
      return 42;
    });

    expect(result).toBe(42);
    expect(seen).toEqual([txClient]); // the callback got the transaction client
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
