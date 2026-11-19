import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
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

/** Client Prisma normal, ou client d'une transaction en cours ($transaction). */
type Db = Pick<PrismaService, 'companyMember' | '$queryRaw'>;

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

  /**
   * @param db à fournir pour lire DANS une transaction (sinon : connexion normale).
   */
  async currentCompany(
    userId: string,
    db: Db | Prisma.TransactionClient = this.prisma,
  ): Promise<CurrentCompany> {
    // userId est unique dans CompanyMember : un compte appartient à une seule entreprise.
    const membership = await db.companyMember.findUnique({
      where: { userId },
      select: { company: { select: { id: true, name: true, status: true } } },
    });
    if (!membership) throw new ForbiddenException(NO_COMPANY_MESSAGE);
    return membership.company;
  }

  /**
   * Entreprise de l'utilisateur, dont la ligne est VERROUILLÉE jusqu'à la fin de la
   * transaction (SELECT … FOR SHARE) : son statut ne peut pas changer pendant
   * l'opération (ex. l'administration refuse l'entreprise au moment précis où
   * elle publie une offre). Le statut renvoyé est celui relu sous verrou.
   */
  async lockCurrentCompany(
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<CurrentCompany> {
    const company = await this.currentCompany(userId, tx);
    const [locked] = await tx.$queryRaw<{ status: CompanyStatus }[]>`
      SELECT "status" FROM "Company" WHERE "id" = ${company.id}::uuid FOR SHARE`;
    if (!locked) throw new ForbiddenException(NO_COMPANY_MESSAGE);
    return { ...company, status: locked.status };
  }
}
