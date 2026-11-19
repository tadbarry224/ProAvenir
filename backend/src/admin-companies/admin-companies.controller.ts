import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { Roles } from '../auth/auth.decorators.js';
import { apiError } from '../common/api-error.js';
import type { AdminCompaniesResponse, AdminCompany } from './admin-company.js';
import { AdminCompaniesService } from './admin-companies.service.js';
import { ADMIN_COMPANY_ERROR_CODES } from './company-review-rules.js';
import { ReviewCompanyDto } from './dto/review-company.dto.js';

/** Identifiant d'entreprise dans l'URL : un UUID, sinon 400 avant toute requête en base. */
const companyIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    apiError(
      400,
      ADMIN_COMPANY_ERROR_CODES.invalidCompanyId,
      'Identifiant d’entreprise invalide.',
    ),
});

/**
 * Vérification des entreprises par l'administration.
 *
 * Sécurité :
 * - pas de @Public() : la garde globale exige un jeton d'accès valide (401 sinon) ;
 * - @Roles('ADMIN') : un candidat ou une entreprise reçoit 403. Un compte
 *   administrateur ne peut jamais être créé par l'inscription publique.
 */
@Roles('ADMIN')
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly companies: AdminCompaniesService) {}

  @Get()
  list(): Promise<AdminCompaniesResponse> {
    return this.companies.list();
  }

  @Patch(':id/status')
  review(
    @Param('id', companyIdPipe) companyId: string,
    @Body() dto: ReviewCompanyDto,
  ): Promise<AdminCompany> {
    return this.companies.review(companyId, dto);
  }
}
