import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { ListOffersQueryDto } from './dto/list-offers-query.dto.js';
import { OffersService } from './offers.service.js';
import type { PublicOffersResponse } from './public-offer.js';

/**
 * GET /api/offers : offres publiques (aucune connexion requise).
 * Filtres facultatifs : city, domain, type (JOB | INTERNSHIP), q (recherche).
 * Les paramètres sont validés par ListOffersQueryDto (400 si invalides).
 */
@Public()
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@Query() query: ListOffersQueryDto): Promise<PublicOffersResponse> {
    return this.offers.listPublic(query);
  }
}
