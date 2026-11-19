import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { CompanyStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  adminCompanySelect,
  byReviewPriority,
  toAdminCompany,
  type AdminCompaniesResponse,
  type AdminCompany,
} from './admin-company.js';
import {
  ADMIN_COMPANY_ERROR_CODES,
  COMPANY_NOT_FOUND,
  reviewData,
  reviewRefusal,
} from './company-review-rules.js';
import type { ReviewCompanyDto } from './dto/review-company.dto.js';

@Injectable()
export class AdminCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toutes les entreprises, celles à vérifier en premier. */
  async list(): Promise<AdminCompaniesResponse> {
    const rows = await this.prisma.company.findMany({
      select: adminCompanySelect,
    });
    const data = rows.map(toAdminCompany).sort(byReviewPriority);
    const pending = data.filter((c) => c.status === 'PENDING').length;
    return { data, meta: { total: data.length, pending } };
  }

  /**
   * Approuve ou refuse une entreprise.
   *
   * La ligne de l'entreprise est verrouillée (`FOR UPDATE`) pendant la décision :
   * - deux administrateurs ne peuvent pas décider en même temps sur des données périmées ;
   * - une création ou publication d'offre en cours (qui verrouille l'entreprise
   *   `FOR SHARE`, voir CompanyMembershipService) se termine avant, ou attend la
   *   décision : une entreprise refusée ne peut donc plus rien publier ensuite.
   */
  async review(
    companyId: string,
    dto: ReviewCompanyDto,
  ): Promise<AdminCompany> {
    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { status: CompanyStatus; name: string }[]
      >`
        SELECT "status", "name" FROM "Company" WHERE "id" = ${companyId}::uuid FOR UPDATE`;
      if (!locked) {
        throw apiError(
          404,
          ADMIN_COMPANY_ERROR_CODES.companyNotFound,
          COMPANY_NOT_FOUND,
        );
      }
      if (dto.expectedName !== undefined && locked.name !== dto.expectedName) {
        throw apiError(
          409,
          ADMIN_COMPANY_ERROR_CODES.identityChanged,
          'Le nom de l’entreprise a changé. Vérifiez le nouveau nom avant de décider.',
        );
      }
      const refusal = reviewRefusal(locked.status, dto.status);
      if (refusal) {
        throw apiError(409, ADMIN_COMPANY_ERROR_CODES.alreadyInStatus, refusal);
      }
      const row = await tx.company.update({
        where: { id: companyId },
        data: reviewData(dto.status, dto.reason, new Date()),
        select: adminCompanySelect,
      });
      return toAdminCompany(row);
    });
  }
}
