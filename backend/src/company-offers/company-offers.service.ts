import { Injectable } from '@nestjs/common';
import {
  apiError,
  VALIDATION_FAILED,
  type ErrorDetail,
} from '../common/api-error.js';
import { ClockService } from '../common/clock.service.js';
import { toIsoDate } from '../common/dates.js';
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
  OFFER_ERROR_CODES,
  publicationErrors,
  type Refusal,
  statusChangeDates,
  statusChangeRefusal,
  type StatusTarget,
} from './offer-rules.js';

export const UNKNOWN_CITY = 'Choisissez une ville dans la liste.';
export const UNKNOWN_DOMAIN = 'Choisissez un domaine dans la liste.';
/** Même réponse pour une offre inexistante ET pour l'offre d'une autre entreprise. */
export const OFFER_NOT_FOUND = 'Offre introuvable.';

/** Transforme un refus des règles métier en erreur HTTP (403 ou 409). */
const refused = (refusal: Refusal) =>
  apiError(refusal.statusCode, refusal.code, refusal.message);

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
        company: {
          name: company.name,
          status: company.status,
          rejectionReason: company.rejectionReason,
        },
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
      if (refusal) throw refused(refusal);

      const description = dto.description ?? '';
      const deadline = dto.deadline ?? null;
      const errors = [
        ...(await this.referenceErrors(tx, dto)),
        ...contractErrors(dto),
        ...(dto.status === 'PUBLISHED'
          ? publicationErrors({ description, deadline }, today)
          : []),
      ];
      // Même code que les erreurs du DTO : ce sont des erreurs de formulaire.
      if (errors.length > 0) {
        throw apiError(400, VALIDATION_FAILED, null, errors);
      }

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

  /**
   * Publier un brouillon, clôturer une offre publiée ou rouvrir une offre clôturée.
   *
   * Ordre des contrôles, dans une seule transaction :
   * 1. entreprise de la session, ligne verrouillée (FOR SHARE) : son statut ne peut
   *    pas changer pendant l'opération ;
   * 2. offre de CETTE entreprise, ligne verrouillée (FOR UPDATE) : deux demandes
   *    simultanées sur la même offre passent l'une après l'autre, la seconde voit
   *    le résultat de la première. Offre absente ou d'une autre entreprise : 404 ;
   * 3. transition et droits (statusChangeRefusal) : 403 ou 409 ;
   * 4. pour publier ou rouvrir : contenu complet et date limite non dépassée
   *    (publicationErrors) : 409 ;
   * 5. mise à jour du statut et des dates (fixées par le serveur).
   * Verrous toujours pris dans le même ordre (entreprise, puis offre).
   */
  async changeStatus(
    userId: string,
    offerId: string,
    target: StatusTarget,
  ): Promise<CompanyOffer> {
    const today = this.clock.today();

    return this.prisma.$transaction(async (tx) => {
      const company = await this.membership.lockCurrentCompany(userId, tx);

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Offer"
        WHERE "id" = ${offerId}::uuid AND "companyId" = ${company.id}::uuid
        FOR UPDATE`;
      if (locked.length === 0) {
        throw apiError(404, OFFER_ERROR_CODES.offerNotFound, OFFER_NOT_FOUND);
      }

      const offer = await tx.offer.findUniqueOrThrow({
        where: { id: offerId },
        select: {
          status: true,
          description: true,
          deadline: true,
          publishedAt: true,
        },
      });

      const refusal = statusChangeRefusal(company.status, offer.status, target);
      if (refusal) throw refused(refusal);

      if (target === 'PUBLISHED') {
        const errors = publicationErrors(
          {
            description: offer.description,
            deadline: offer.deadline ? toIsoDate(offer.deadline) : null,
          },
          today,
        );
        if (errors.length > 0) {
          throw apiError(409, OFFER_ERROR_CODES.notPublishable, null, errors);
        }
      }

      const row = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: target,
          ...statusChangeDates(target, offer.publishedAt, new Date()),
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
  ): Promise<ErrorDetail[]> {
    const [city, domain] = await Promise.all([
      tx.city.findUnique({ where: { id: dto.cityId }, select: { id: true } }),
      tx.domain.findUnique({
        where: { id: dto.domainId },
        select: { id: true },
      }),
    ]);
    const errors: ErrorDetail[] = [];
    if (!city) errors.push({ field: 'cityId', message: UNKNOWN_CITY });
    if (!domain) errors.push({ field: 'domainId', message: UNKNOWN_DOMAIN });
    return errors;
  }
}
