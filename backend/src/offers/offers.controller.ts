import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { offerIdPipe } from '../common/offer-id.pipe.js';
import { ListOffersQueryDto } from './dto/list-offers-query.dto.js';
import { OffersService } from './offers.service.js';
import type { PublicOffer, PublicOffersResponse } from './public-offer.js';

/**
 * Offres publiques (aucune connexion requise).
 * - GET /api/offers : filtres facultatifs city, domain, type (JOB | INTERNSHIP),
 *   q (recherche), validés par ListOffersQueryDto (400 si invalides) ;
 * - GET /api/offers/:id : une offre publique (lien partagé, page détail).
 */
@Public()
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@Query() query: ListOffersQueryDto): Promise<PublicOffersResponse> {
    return this.offers.listPublic(query);
  }

  @Get(':id')
  findOne(@Param('id', offerIdPipe) id: string): Promise<PublicOffer> {
    return this.offers.findPublic(id);
  }
}
