import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Élément d'un référentiel (ville, domaine) : identifiant stable + libellé affiché. */
export interface ReferenceItem {
  id: string;
  name: string;
}

/** Listes de référence utilisées par les filtres et les formulaires. */
@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  listCities(): Promise<ReferenceItem[]> {
    return this.prisma.city.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listDomains(): Promise<ReferenceItem[]> {
    return this.prisma.domain.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
