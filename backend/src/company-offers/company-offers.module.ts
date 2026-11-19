import { Module } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { CompanyMembershipService } from './company-membership.service.js';
import { CompanyOffersController } from './company-offers.controller.js';
import { CompanyOffersService } from './company-offers.service.js';

/** Espace entreprise : gestion de ses propres offres (B4). */
@Module({
  controllers: [CompanyOffersController],
  providers: [CompanyOffersService, CompanyMembershipService, ClockService],
  // Utilisé aussi par les candidatures (candidatures reçues par l'entreprise).
  exports: [CompanyMembershipService],
})
export class CompanyOffersModule {}
