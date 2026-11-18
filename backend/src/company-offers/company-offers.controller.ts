import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import type { CompanyOffersResponse } from './company-offer.js';
import { CompanyOffersService } from './company-offers.service.js';

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
}
