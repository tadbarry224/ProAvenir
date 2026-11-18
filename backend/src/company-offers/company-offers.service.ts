import { Injectable } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  companyOfferSelect,
  companyOffersOrderBy,
  toCompanyOffer,
  type CompanyOffersResponse,
} from './company-offer.js';
import { CompanyMembershipService } from './company-membership.service.js';

@Injectable()
export class CompanyOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly membership: CompanyMembershipService,
  ) {}

  /**
   * Toutes les offres de l'entreprise de l'utilisateur, quel que soit leur statut.
   * Le filtre `companyId` vient de la base (CompanyMember), jamais de la requête.
   * Accessible aussi aux entreprises en attente ou refusées (lecture seule).
   */
  async listMine(userId: string): Promise<CompanyOffersResponse> {
    const company = await this.membership.currentCompany(userId);
    const today = this.clock.today();

    const rows = await this.prisma.offer.findMany({
      where: { companyId: company.id },
      select: companyOfferSelect,
      orderBy: companyOffersOrderBy,
    });

    const data = rows.map((row) => toCompanyOffer(row, company, today));
    return {
      data,
      meta: {
        total: data.length,
        today,
        company: { name: company.name, status: company.status },
      },
    };
  }
}
