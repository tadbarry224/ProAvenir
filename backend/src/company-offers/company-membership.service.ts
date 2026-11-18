import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CompanyStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Entreprise de l'utilisateur connecté (lue en base, jamais fournie par le client). */
export interface CurrentCompany {
  id: string;
  name: string;
  status: CompanyStatus;
}

export const NO_COMPANY_MESSAGE =
  'Aucune entreprise n’est associée à ce compte.';

/**
 * Retrouve l'entreprise d'un utilisateur à partir de la table CompanyMember.
 *
 * Sécurité : c'est la SEULE source de l'identifiant d'entreprise pour les routes
 * « /companies/me/… ». Un identifiant envoyé dans l'URL ou dans le corps d'une
 * requête n'est jamais utilisé : une entreprise ne peut donc agir que sur ses
 * propres données.
 */
@Injectable()
export class CompanyMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async currentCompany(userId: string): Promise<CurrentCompany> {
    // userId est unique dans CompanyMember : un compte appartient à une seule entreprise.
    const membership = await this.prisma.companyMember.findUnique({
      where: { userId },
      select: { company: { select: { id: true, name: true, status: true } } },
    });
    if (!membership) throw new ForbiddenException(NO_COMPANY_MESSAGE);
    return membership.company;
  }
}
