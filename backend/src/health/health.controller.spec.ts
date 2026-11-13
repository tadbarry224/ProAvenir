import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

/** Tests unitaires : la base est simulée, aucun PostgreSQL n'est nécessaire. */
describe('HealthController', () => {
  async function createController(queryRaw: () => Promise<unknown>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: vi.fn(queryRaw) } },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('répond « ok » quand la base répond', async () => {
    const controller = await createController(() =>
      Promise.resolve([{ '?column?': 1 }]),
    );
    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('répond 503 sans détail technique quand la base ne répond pas', async () => {
    const controller = await createController(() =>
      Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5434')),
    );
    const error = await controller.check().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse();
    expect(body).toMatchObject({ status: 'error', database: 'down' });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });
});
