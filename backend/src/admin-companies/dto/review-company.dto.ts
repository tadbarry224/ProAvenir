import { Transform } from 'class-transformer';
import {
  IsIn,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  REJECTION_REASON,
  REVIEW_TARGETS,
  type ReviewTarget,
} from '../company-review-rules.js';

/** Espaces en trop retirés, et suites d'espaces réduites à un seul. */
const collapse = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

const REASON_MESSAGES = {
  required: 'Le motif du refus est obligatoire.',
  length: `Le motif du refus doit contenir entre ${REJECTION_REASON.min} et ${REJECTION_REASON.max} caractères.`,
  forbidden: 'Une approbation ne prend pas de motif.',
} as const;

/**
 * Le motif dépend du statut choisi : obligatoire pour un refus (montré ensuite à
 * l'entreprise), interdit pour une approbation (un motif périmé n'a pas de sens).
 */
@ValidatorConstraint({ name: 'reasonMatchesStatus' })
class ReasonMatchesStatus implements ValidatorConstraintInterface {
  private problem(value: unknown, status: unknown): string | null {
    if (status === 'APPROVED') {
      return value === undefined || value === null || value === ''
        ? null
        : REASON_MESSAGES.forbidden;
    }
    if (status !== 'REJECTED') return null; // statut invalide : signalé par @IsIn
    if (typeof value !== 'string' || value === '')
      return REASON_MESSAGES.required;
    return value.length >= REJECTION_REASON.min &&
      value.length <= REJECTION_REASON.max
      ? null
      : REASON_MESSAGES.length;
  }

  validate(value: unknown, args: ValidationArguments): boolean {
    const { status } = args.object as { status?: unknown };
    return this.problem(value, status) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const { status } = args.object as { status?: unknown };
    return this.problem(args.value, status) ?? REASON_MESSAGES.required;
  }
}

/**
 * Corps de PATCH /api/admin/companies/:id/status.
 * - status : APPROVED (approuver) ou REJECTED (refuser) ;
 * - reason : motif obligatoire pour un refus, interdit pour une approbation.
 * Tout autre champ est refusé (400).
 */
export class ReviewCompanyDto {
  @IsIn(REVIEW_TARGETS, {
    message:
      'Le statut doit valoir APPROVED (approuver) ou REJECTED (refuser).',
  })
  status: ReviewTarget;

  @Transform(collapse)
  @Validate(ReasonMatchesStatus)
  reason?: string;
}
