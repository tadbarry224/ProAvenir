import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  APPLICATION_MESSAGE_MAX,
  APPLICATION_STATUS_TARGETS,
  type ApplicationStatusTarget,
} from '../application-rules.js';

/** Espaces en trop retirés ; un message vide devient « pas de message ». */
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

/**
 * Corps de POST /api/candidates/me/applications.
 * Le candidat vient de la session : aucun identifiant de candidat n'est accepté.
 * Tout autre champ (statut, CV, date…) est refusé (400).
 */
export class CreateApplicationDto {
  @IsUUID('all', { message: 'Choisissez une offre valide.' })
  offerId: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString({ message: 'Le message doit être un texte.' })
  @MaxLength(APPLICATION_MESSAGE_MAX, {
    message: `Le message au recruteur ne doit pas dépasser ${APPLICATION_MESSAGE_MAX} caractères.`,
  })
  message?: string;
}

/** Corps de PATCH /api/companies/me/applications/:id/status. */
export class ChangeApplicationStatusDto {
  @IsIn(APPLICATION_STATUS_TARGETS, {
    message:
      'Le statut doit valoir IN_REVIEW, SHORTLISTED, ACCEPTED ou REJECTED.',
  })
  status: ApplicationStatusTarget;
}
