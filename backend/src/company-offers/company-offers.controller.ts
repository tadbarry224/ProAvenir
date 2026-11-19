import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { apiError } from '../common/api-error.js';
import type { CompanyOffer, CompanyOffersResponse } from './company-offer.js';
import { CompanyOffersService } from './company-offers.service.js';
import { ChangeOfferStatusDto } from './dto/change-offer-status.dto.js';
import { CreateCompanyOfferDto } from './dto/create-company-offer.dto.js';
import { OFFER_ERROR_CODES } from './offer-rules.js';

/** Identifiant d'offre dans l'URL : un UUID, sinon 400 avant toute requête en base. */
const offerIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    apiError(
      400,
      OFFER_ERROR_CODES.invalidOfferId,
      'Identifiant d’offre invalide.',
    ),
});

/**
 * Offres de l'entreprise connectée (espace entreprise).
 *
 * Sécurité :
 * - pas de @Public() : la garde globale exige un jeton d'accès valide (401 sinon) ;
 * - @Roles('COMPANY') : un candidat ou un administrateur reçoit 403 ;
 * - « me » : l'entreprise est déduite de la session (CompanyMember), aucun
 *   identifiant d'entreprise n'est accepté dans l'URL.
 * Le jeton est envoyé dans l'en-tête Authorization (jamais automatiquement par le
 * navigateur) : ces routes n'ont donc pas besoin de la protection CSRF des cookies.
 */
@Roles('COMPANY')
@Controller('companies/me/offers')
export class CompanyOffersController {
  constructor(private readonly companyOffers: CompanyOffersService) {}

  /** GET /api/companies/me/offers : brouillons, publiées, clôturées et expirées. */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<CompanyOffersResponse> {
    return this.companyOffers.listMine(user.id);
  }

  /**
   * POST /api/companies/me/offers : crée un brouillon ou publie directement (201).
   * Le corps est validé par CreateCompanyOfferDto (champs inconnus refusés).
   */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyOfferDto,
  ): Promise<CompanyOffer> {
    return this.companyOffers.create(user.id, dto);
  }

  /**
   * PATCH /api/companies/me/offers/:id/status : publier un brouillon, clôturer
   * ou rouvrir (200 + l'offre à jour). L'offre doit appartenir à l'entreprise
   * de la session, sinon 404 (on ne révèle pas l'existence des offres des autres).
   */
  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', offerIdPipe) offerId: string,
    @Body() dto: ChangeOfferStatusDto,
  ): Promise<CompanyOffer> {
    return this.companyOffers.changeStatus(user.id, offerId, dto.status);
  }
}
