import { Injectable } from '@nestjs/common';
import {
  CandidateProfileService,
  type CvDownload,
} from '../candidate-profile/candidate-profile.service.js';
import { CV_ERROR_CODES, CV_MESSAGES } from '../candidate-profile/cv-rules.js';
import { apiError } from '../common/api-error.js';
import { ClockService } from '../common/clock.service.js';
import { toIsoDate } from '../common/dates.js';
import { isPubliclyVisible } from '../company-offers/company-offer.js';
import { CompanyMembershipService } from '../company-offers/company-membership.service.js';
import { OFFER_ERROR_CODES } from '../company-offers/offer-rules.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  ApplicationStatus,
  CompanyStatus,
  OfferStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  applicationsOrderBy,
  candidateApplicationSelect,
  receivedApplicationSelect,
  toCandidateApplication,
  toReceivedApplication,
  type CandidateApplication,
  type CandidateApplicationsResponse,
  type ReceivedApplication,
  type ReceivedApplicationsResponse,
} from './application.js';
import {
  APPLICATION_ERROR_CODES,
  APPLICATION_MESSAGES,
  applicationTransitionRefusal,
  type ApplicationStatusTarget,
} from './application-rules.js';
import type { CreateApplicationDto } from './dto/application.dto.js';

const offerNotAvailable = () =>
  apiError(
    404,
    APPLICATION_ERROR_CODES.offerNotAvailable,
    APPLICATION_MESSAGES.offerNotAvailable,
  );
const alreadyApplied = () =>
  apiError(
    409,
    APPLICATION_ERROR_CODES.alreadyApplied,
    APPLICATION_MESSAGES.alreadyApplied,
  );

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly membership: CompanyMembershipService,
    private readonly profiles: CandidateProfileService,
  ) {}

  /**
   * CV joint à une candidature reçue par l'entreprise de la session. Une
   * candidature d'une autre entreprise donne 404, comme une candidature sans CV.
   */
  async downloadReceivedCv(
    userId: string,
    applicationId: string,
  ): Promise<CvDownload> {
    const company = await this.membership.currentCompany(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, offer: { companyId: company.id } },
      select: { cvFileKey: true, cvFileName: true },
    });
    if (!application) {
      throw apiError(
        404,
        APPLICATION_ERROR_CODES.applicationNotFound,
        APPLICATION_MESSAGES.applicationNotFound,
      );
    }
    if (!application.cvFileKey || !application.cvFileName) {
      throw apiError(404, CV_ERROR_CODES.cvNotFound, CV_MESSAGES.cvNotFound);
    }
    return this.profiles.readFile(
      application.cvFileKey,
      application.cvFileName,
    );
  }

  // --- Côté candidat ----------------------------------------------------------

  /** Profil du candidat connecté (lu en base, jamais fourni par le client). */
  private async candidateProfile(
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    // Le retrait ou le remplacement du CV attend que la candidature soit enregistrée.
    const profile = tx
      ? (
          await tx.$queryRaw<
            {
              id: string;
              cvFileKey: string | null;
              cvFileName: string | null;
            }[]
          >`
            SELECT "id", "cvFileKey", "cvFileName"
            FROM "CandidateProfile"
            WHERE "userId" = ${userId}::uuid
            FOR SHARE`
        )[0]
      : await this.prisma.candidateProfile.findUnique({
          where: { userId },
          select: { id: true, cvFileKey: true, cvFileName: true },
        });
    if (!profile) {
      throw apiError(
        403,
        APPLICATION_ERROR_CODES.noCandidateProfile,
        APPLICATION_MESSAGES.noCandidateProfile,
      );
    }
    return profile;
  }

  /** « Mes candidatures », les plus récentes d'abord. */
  async listMine(userId: string): Promise<CandidateApplicationsResponse> {
    const profile = await this.candidateProfile(userId);
    const today = this.clock.today();
    const rows = await this.prisma.application.findMany({
      where: { candidateId: profile.id },
      select: candidateApplicationSelect,
      orderBy: applicationsOrderBy,
    });
    const data = rows.map((row) => toCandidateApplication(row, today));
    return { data, meta: { total: data.length } };
  }

  /**
   * Postuler à une offre.
   *
   * L'offre et son entreprise sont VERROUILLÉES (FOR SHARE) pendant le dépôt : une
   * clôture de l'offre ou un refus de l'entreprise au même instant attend la fin
   * du dépôt, ou le fait échouer s'il passe avant. On ne peut donc postuler qu'à une
   * offre réellement publique (publiée, non expirée, entreprise validée).
   * Le CV actuel du profil est recopié : le candidat pourra le remplacer ensuite
   * sans changer ce que le recruteur a reçu.
   */
  async apply(
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<CandidateApplication> {
    const today = this.clock.today();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await this.candidateProfile(userId, tx);
        // Entreprise d'abord, puis offre : même ordre que l'espace entreprise.
        const [offer] = await tx.$queryRaw<
          {
            status: OfferStatus;
            deadline: Date | null;
            companyStatus: CompanyStatus;
          }[]
        >`
          SELECT o."status", o."deadline", c."status" AS "companyStatus"
          FROM "Offer" o JOIN "Company" c ON c."id" = o."companyId"
          WHERE o."id" = ${dto.offerId}::uuid
          FOR SHARE OF c, o`;
        const visible =
          offer &&
          isPubliclyVisible(
            {
              status: offer.status,
              deadline: offer.deadline ? toIsoDate(offer.deadline) : null,
            },
            offer.companyStatus,
            today,
          );
        if (!visible) throw offerNotAvailable();

        const existing = await tx.application.findUnique({
          where: {
            offerId_candidateId: {
              offerId: dto.offerId,
              candidateId: profile.id,
            },
          },
          select: { id: true },
        });
        if (existing) throw alreadyApplied();

        const row = await tx.application.create({
          data: {
            offerId: dto.offerId,
            candidateId: profile.id,
            message: dto.message ?? null,
            cvFileKey: profile.cvFileKey,
            cvFileName: profile.cvFileName,
          },
          select: candidateApplicationSelect,
        });
        return toCandidateApplication(row, today);
      });
    } catch (error) {
      // Deux envois simultanés : la contrainte unique (offre, candidat) tranche.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw alreadyApplied();
      }
      throw error;
    }
  }

  // --- Côté entreprise --------------------------------------------------------

  /** Candidatures reçues sur les offres de l'entreprise connectée. */
  async listReceived(userId: string): Promise<ReceivedApplicationsResponse> {
    const company = await this.membership.currentCompany(userId);
    const rows = await this.prisma.application.findMany({
      where: { offer: { companyId: company.id } },
      select: receivedApplicationSelect,
      orderBy: applicationsOrderBy,
    });
    const data = rows.map(toReceivedApplication);
    return { data, meta: { total: data.length } };
  }

  /**
   * Fait avancer une candidature (en examen, présélectionnée, retenue, refusée).
   * La candidature doit concerner une offre de l'entreprise de la session, sinon
   * 404 (on ne révèle pas les candidatures des autres). Verrous : entreprise
   * (FOR SHARE) puis candidature (FOR UPDATE).
   */
  async changeStatus(
    userId: string,
    applicationId: string,
    target: ApplicationStatusTarget,
  ): Promise<ReceivedApplication> {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.membership.lockCurrentCompany(userId, tx);
      if (company.status === 'REJECTED') {
        throw apiError(
          403,
          OFFER_ERROR_CODES.companyRejected,
          APPLICATION_MESSAGES.companyRejected,
        );
      }
      const [current] = await tx.$queryRaw<{ status: ApplicationStatus }[]>`
        SELECT a."status" FROM "Application" a
        JOIN "Offer" o ON o."id" = a."offerId"
        WHERE a."id" = ${applicationId}::uuid AND o."companyId" = ${company.id}::uuid
        FOR UPDATE OF a`;
      if (!current) {
        throw apiError(
          404,
          APPLICATION_ERROR_CODES.applicationNotFound,
          APPLICATION_MESSAGES.applicationNotFound,
        );
      }
      const refusal = applicationTransitionRefusal(current.status, target);
      if (refusal) {
        throw apiError(409, APPLICATION_ERROR_CODES.invalidTransition, refusal);
      }
      const row = await tx.application.update({
        where: { id: applicationId },
        data: { status: target },
        select: receivedApplicationSelect,
      });
      return toReceivedApplication(row);
    });
  }
}
