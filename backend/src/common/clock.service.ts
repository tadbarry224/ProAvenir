import { Injectable } from '@nestjs/common';

/** Fuseau horaire de référence de la plateforme (Guinée, UTC+0 toute l'année). */
export const PLATFORM_TIME_ZONE = 'Africa/Conakry';

/**
 * Donne la date du jour. Isolée dans un service pour que les tests puissent
 * la remplacer (`overrideProvider(ClockService)`) et vérifier par exemple
 * qu'une offre reste visible le jour même de sa date limite.
 */
@Injectable()
export class ClockService {
  /** Date du jour à Conakry, au format "AAAA-MM-JJ" (comme une colonne DATE). */
  today(now: Date = new Date()): string {
    // La locale en-CA formate les dates en AAAA-MM-JJ.
    return now.toLocaleDateString('en-CA', { timeZone: PLATFORM_TIME_ZONE });
  }
}
