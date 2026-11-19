import { ParseUUIDPipe } from '@nestjs/common';
import { OFFER_ERROR_CODES } from '../company-offers/offer-rules.js';
import { apiError } from './api-error.js';

/**
 * Identifiant d'offre dans l'URL (`:id`) : un UUID, sinon 400 INVALID_OFFER_ID
 * avant toute requête en base. Partagé par les routes publiques et l'espace entreprise.
 */
export const offerIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    apiError(
      400,
      OFFER_ERROR_CODES.invalidOfferId,
      'Identifiant d’offre invalide.',
    ),
});
