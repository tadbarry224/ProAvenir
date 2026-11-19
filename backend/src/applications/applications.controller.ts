import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { pdfDownload } from '../candidate-profile/cv-http.js';
import { apiError } from '../common/api-error.js';
import type {
  CandidateApplication,
  CandidateApplicationsResponse,
  ReceivedApplication,
  ReceivedApplicationsResponse,
} from './application.js';
import { APPLICATION_ERROR_CODES } from './application-rules.js';
import { ApplicationsService } from './applications.service.js';
import {
  ChangeApplicationStatusDto,
  CreateApplicationDto,
} from './dto/application.dto.js';

/** Identifiant de candidature dans l'URL : un UUID, sinon 400 avant toute requête. */
const applicationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    apiError(
      400,
      APPLICATION_ERROR_CODES.invalidApplicationId,
      'Identifiant de candidature invalide.',
    ),
});

/**
 * Candidatures du candidat connecté (rôle CANDIDATE).
 * Le candidat est déduit de la session : aucun identifiant n'est lu dans la requête.
 */
@Roles('CANDIDATE')
@Controller('candidates/me/applications')
export class CandidateApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<CandidateApplicationsResponse> {
    return this.applications.listMine(user.id);
  }

  /** Postuler : 201 + la candidature, 409 si déjà fait, 404 si l'offre n'est plus publique. */
  @Post()
  apply(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApplicationDto,
  ): Promise<CandidateApplication> {
    return this.applications.apply(user.id, dto);
  }
}

/**
 * Candidatures reçues par l'entreprise connectée (rôle COMPANY).
 * L'entreprise est déduite de la session (CompanyMember), jamais de l'URL.
 */
@Roles('COMPANY')
@Controller('companies/me/applications')
export class CompanyApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ReceivedApplicationsResponse> {
    return this.applications.listReceived(user.id);
  }

  /** CV joint à la candidature (PDF à télécharger), si l'offre est à cette entreprise. */
  @Get(':id/cv')
  async downloadCv(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationIdPipe) applicationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return pdfDownload(
      await this.applications.downloadReceivedCv(user.id, applicationId),
      res,
    );
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationIdPipe) applicationId: string,
    @Body() dto: ChangeApplicationStatusDto,
  ): Promise<ReceivedApplication> {
    return this.applications.changeStatus(user.id, applicationId, dto.status);
  }
}
