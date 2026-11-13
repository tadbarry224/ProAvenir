import { Injectable } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListOffersQueryDto } from './dto/list-offers-query.dto.js';
import {
  publicOfferSelect,
  publicOffersWhere,
  toPublicOffer,
  type PublicOffersResponse,
} from './public-offer.js';

/** Protège un texte utilisé dans un motif LIKE : `%` et `_` y sont des jokers. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Offres publiques correspondant aux filtres, les plus récentes d'abord. */
  async listPublic(query: ListOffersQueryDto): Promise<PublicOffersResponse> {
    const today = this.clock.today();
    const filters: Prisma.OfferWhereInput[] = [publicOffersWhere(today)];
    if (query.city) filters.push({ cityId: query.city });
    if (query.domain) filters.push({ domainId: query.domain });
    if (query.type) filters.push({ type: query.type });
    if (query.q) filters.push(await this.searchFilter(query.q));

    const rows = await this.prisma.offer.findMany({
      where: { AND: filters },
      select: publicOfferSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
    });
    const data = rows.map(toPublicOffer);
    return { data, meta: { total: data.length, today } };
  }

  /**
   * Recherche (sans tenir compte des majuscules) dans l'intitulé, le nom de
   * l'entreprise ou l'une des compétences : « excel » trouve « Excel ».
   */
  private async searchFilter(q: string): Promise<Prisma.OfferWhereInput> {
    // Prisma ne sait pas chercher un morceau de texte dans un tableau (skills) :
    // petite requête SQL dédiée. Le motif est transmis en paramètre (jamais
    // concaténé dans le SQL), ce qui empêche toute injection SQL.
    // `contains` de Prisma n'échappe pas non plus % et _ : sans `escapeLike`,
    // une recherche « % » renverrait toutes les offres.
    const escaped = escapeLike(q);
    const skillMatches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Offer"
      WHERE EXISTS (SELECT 1 FROM unnest("skills") AS skill WHERE skill ILIKE ${`%${escaped}%`})`;

    return {
      OR: [
        { title: { contains: escaped, mode: 'insensitive' } },
        { company: { name: { contains: escaped, mode: 'insensitive' } } },
        { id: { in: skillMatches.map((row) => row.id) } },
      ],
    };
  }
}
