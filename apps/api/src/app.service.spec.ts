import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppService.getHealth', () => {
  it('reports db up when the ping succeeds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const service = moduleRef.get(AppService);
    const result = await service.getHealth();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({ status: 'ok', db: 'up' }),
    );
  });

  it('reports db down when the ping throws', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('no db')) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const result = await moduleRef.get(AppService).getHealth();
    expect(result).toEqual(
      expect.objectContaining({ status: 'degraded', db: 'down' }),
    );
  });
});
