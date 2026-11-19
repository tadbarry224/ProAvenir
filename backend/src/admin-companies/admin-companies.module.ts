import { Module } from '@nestjs/common';
import { AdminCompaniesController } from './admin-companies.controller.js';
import { AdminCompaniesService } from './admin-companies.service.js';

/** Administration : vérification (approbation, refus) des entreprises. */
@Module({
  controllers: [AdminCompaniesController],
  providers: [AdminCompaniesService],
})
export class AdminCompaniesModule {}
