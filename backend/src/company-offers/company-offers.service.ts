import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  companyOfferSelect,
  companyOffersOrderBy,
  toCompanyOffer,
  type CompanyOffer,
  type CompanyOffersResponse,
} from './company-offer.js';
import { CompanyMembershipService } from './company-membership.service.js';
import type { CreateCompanyOfferDto } from './dto/create-company-offer.dto.js';
import {
  contractErrors,
  creationRefusal,
  publicationErrors,
} from './offer-rules.js';

export const UNKNOWN_CITY = 'Choisissez une ville dans la liste.';
export const UNKNOWN_DOMAIN = 'Choisissez un domaine dans la liste.';

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

  /**
   * Crée une offre (brouillon ou publiée) pour l'entreprise de l'utilisateur.
   *
   * Ordre des contrôles :
   * 1. entreprise de la session (403 si aucune), ligne verrouillée jusqu'à la fin ;
   * 2. droit selon son statut (403) : REJECTED aucune création, PENDING brouillon seul ;
   * 3. données : ville et domaine existants, contrat cohérent, conditions de
   *    publication (400, tous les messages d'un coup) ;
   * 4. enregistrement : companyId, publishedAt et featured fixés par le serveur.
   * Tout se passe dans une seule transaction.
   */
  async create(
    userId: string,
    dto: CreateCompanyOfferDto,
  ): Promise<CompanyOffer> {
    const today = this.clock.today();

    return this.prisma.$transaction(async (tx) => {
      const company = await this.membership.lockCurrentCompany(userId, tx);

      const refusal = creationRefusal(company.status, dto.status);
      if (refusal) throw new ForbiddenException(refusal);

      const description = dto.description ?? '';
      const deadline = dto.deadline ?? null;
      const errors = [
        ...(await this.referenceErrors(tx, dto)),
        ...contractErrors(dto),
        ...(dto.status === 'PUBLISHED'
          ? publicationErrors({ description, deadline }, today)
          : []),
      ];
      if (errors.length > 0) throw new BadRequestException(errors);

      const row = await tx.offer.create({
        data: {
          companyId: company.id,
          status: dto.status,
          title: dto.title,
          type: dto.type,
          cityId: dto.cityId,
          domainId: dto.domainId,
          description,
          deadline: deadline ? new Date(deadline) : null,
          skills: dto.skills ?? [],
          contractType: dto.contractType ?? null,
          workSchedule: dto.workSchedule ?? null,
          duration: dto.duration ?? null,
          publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
        },
        select: companyOfferSelect,
      });
      return toCompanyOffer(row, company, today);
    });
  }

  /** Ville et domaine doivent exister (message clair plutôt qu'une erreur de clé étrangère). */
  private async referenceErrors(
    tx: Prisma.TransactionClient,
    dto: Pick<CreateCompanyOfferDto, 'cityId' | 'domainId'>,
  ): Promise<string[]> {
    const [city, domain] = await Promise.all([
      tx.city.findUnique({ where: { id: dto.cityId }, select: { id: true } }),
      tx.domain.findUnique({
        where: { id: dto.domainId },
        select: { id: true },
      }),
    ]);
    const errors: string[] = [];
    if (!city) errors.push(UNKNOWN_CITY);
    if (!domain) errors.push(UNKNOWN_DOMAIN);
    return errors;
  }
}
