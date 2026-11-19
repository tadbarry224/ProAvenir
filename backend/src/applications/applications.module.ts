import { Module } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { CompanyOffersModule } from '../company-offers/company-offers.module.js';
import {
  CandidateApplicationsController,
  CompanyApplicationsController,
} from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

/** Candidatures (B5) : dépôt et suivi par le candidat, traitement par l'entreprise. */
@Module({
  // CompanyOffersModule fournit CompanyMembershipService (entreprise de la session).
  imports: [CompanyOffersModule],
  controllers: [CandidateApplicationsController, CompanyApplicationsController],
  providers: [ApplicationsService, ClockService],
})
export class ApplicationsModule {}
