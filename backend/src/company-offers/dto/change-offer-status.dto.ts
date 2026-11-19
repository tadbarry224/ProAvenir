import { IsIn } from 'class-validator';
import { STATUS_TARGETS, type StatusTarget } from '../offer-rules.js';

/**
 * Corps de PATCH /api/companies/me/offers/:id/status.
 * Seuls « PUBLISHED » (publier ou rouvrir) et « CLOSED » (clôturer) sont acceptés :
 * le retour au brouillon n'existe pas. Tout autre champ est refusé (400).
 */
export class ChangeOfferStatusDto {
  @IsIn(STATUS_TARGETS, {
    message:
      'Le statut doit valoir PUBLISHED (publier ou rouvrir) ou CLOSED (clôturer).',
  })
  status: StatusTarget;
}
