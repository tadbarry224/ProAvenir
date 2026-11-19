import { Injectable } from '@nestjs/common';
import { apiError, VALIDATION_FAILED } from '../common/api-error.js';
import {
  CompanyMembershipService,
  NO_COMPANY_MESSAGE,
} from '../company-offers/company-membership.service.js';
import { OFFER_ERROR_CODES } from '../company-offers/offer-rules.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateCompanyProfileDto } from './update-company-profile.dto.js';

const profileSelect = {
  name: true,
  sector: true,
  city: { select: { id: true, name: true } },
  description: true,
  contactEmail: true,
  phone: true,
  status: true,
} satisfies Prisma.CompanySelect;

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: CompanyMembershipService,
  ) {}

  async get(userId: string) {
    const company = await this.membership.currentCompany(userId);
    return this.prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      select: profileSelect,
    });
  }

  async update(userId: string, dto: UpdateCompanyProfileDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.membership.currentCompany(userId, tx);
      // Verrou exclusif avant de relire l'identité et de changer la validation.
      // La publication, les candidatures et l'administration verrouillent cette même ligne.
      const [current] = await tx.$queryRaw<{ name: string }[]>`
        SELECT "name" FROM "Company" WHERE "id" = ${company.id}::uuid
        FOR NO KEY UPDATE`;
      if (!current) {
        throw apiError(403, OFFER_ERROR_CODES.noCompany, NO_COMPANY_MESSAGE);
      }
      if (
        dto.cityId &&
        !(await tx.city.findUnique({ where: { id: dto.cityId } }))
      ) {
        throw apiError(400, VALIDATION_FAILED, null, [
          { field: 'cityId', message: 'Choisissez une ville dans la liste.' },
        ]);
      }
      const renamed = dto.name !== undefined && dto.name !== current.name;
      return tx.company.update({
        where: { id: company.id },
        data: {
          name: dto.name,
          sector: dto.sector,
          cityId: dto.cityId,
          description: dto.description,
          contactEmail: dto.contactEmail,
          phone: dto.phone,
          ...(renamed && {
            status: 'PENDING',
            reviewedAt: null,
            rejectionReason: null,
          }),
        },
        select: profileSelect,
      });
    });
  }
}
