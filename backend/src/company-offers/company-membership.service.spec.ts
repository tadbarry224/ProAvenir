import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CompanyMembershipService,
  NO_COMPANY_MESSAGE,
} from './company-membership.service.js';

/** Tests unitaires : la base est simulée, aucun PostgreSQL n'est nécessaire. */
describe('CompanyMembershipService', () => {
  const company = {
    id: 'company-1',
    name: 'Entreprise',
    status: 'APPROVED',
    rejectionReason: null,
  };

  function createService(membership: unknown) {
    const findUnique = vi.fn().mockResolvedValue(membership);
    const prisma = { companyMember: { findUnique } };
    const service = new CompanyMembershipService(
      prisma as unknown as PrismaService,
    );
    return { service, findUnique };
  }

  it("renvoie l'entreprise de l'utilisateur, cherchée par son identifiant", async () => {
    const { service, findUnique } = createService({ company });
    await expect(service.currentCompany('user-1')).resolves.toEqual(company);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('ne lit que id, nom et statut de l’entreprise (aucun contact)', async () => {
    const { service, findUnique } = createService({ company });
    await service.currentCompany('user-1');
    expect(findUnique.mock.calls[0][0].select).toEqual({
      company: {
        select: { id: true, name: true, status: true, rejectionReason: true },
      },
    });
  });

  it('refuse (403) un compte qui n’est rattaché à aucune entreprise', async () => {
    const { service } = createService(null);
    const error = await service.currentCompany('user-1').catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toBe(NO_COMPANY_MESSAGE);
  });
});
