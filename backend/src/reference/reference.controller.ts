import { Controller, Get } from '@nestjs/common';
import { ReferenceService, type ReferenceItem } from './reference.service.js';

/** Réponse d'une liste : toujours enveloppée dans `data` (même forme que /offers). */
export interface ListResponse<T> {
  data: T[];
}

/**
 * Référentiels publics (aucune connexion requise) :
 * - GET /api/cities  → { data: [{ id: "boke", name: "Boké" }, …] }
 * - GET /api/domains → { data: [{ id: "commerce", name: "Commerce" }, …] }
 * Triés par ordre alphabétique.
 */
@Controller()
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('cities')
  async cities(): Promise<ListResponse<ReferenceItem>> {
    return { data: await this.reference.listCities() };
  }

  @Get('domains')
  async domains(): Promise<ListResponse<ReferenceItem>> {
    return { data: await this.reference.listDomains() };
  }
}
