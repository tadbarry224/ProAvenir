/**
 * Règles de vérification des entreprises par l'administration, sous forme de
 * fonctions pures (sans base de données) : faciles à tester.
 *
 * Décisions possibles :
 * - PENDING → APPROVED (approuver) ou REJECTED (refuser, motif obligatoire) ;
 * - APPROVED → REJECTED : retirer la validation (ses offres quittent la liste publique) ;
 * - REJECTED → APPROVED : revenir sur un refus.
 * Une décision identique au statut actuel est refusée (409) : elle ne changerait rien
 * et signale souvent un double clic ou un écran périmé.
 */
import type { CompanyStatus } from '../generated/prisma/enums.js';

/** Statuts qu'un administrateur peut choisir (on ne revient jamais à « en attente »). */
export const REVIEW_TARGETS = ['APPROVED', 'REJECTED'] as const;
export type ReviewTarget = (typeof REVIEW_TARGETS)[number];

/** Longueur du motif de refus, montré ensuite à l'entreprise. */
export const REJECTION_REASON = { min: 5, max: 500 } as const;

/**
 * Codes d'erreur STABLES des routes /admin/companies (le frontend s'appuie sur eux) :
 * - 400 INVALID_COMPANY_ID : identifiant mal formé dans l'adresse ;
 * - 400 VALIDATION_FAILED (voir common/api-error.ts) : statut ou motif invalide ;
 * - 404 COMPANY_NOT_FOUND : entreprise inexistante ;
 * - 409 COMPANY_ALREADY_IN_STATUS : l'entreprise a déjà ce statut.
 */
export const ADMIN_COMPANY_ERROR_CODES = {
  invalidCompanyId: 'INVALID_COMPANY_ID',
  companyNotFound: 'COMPANY_NOT_FOUND',
  alreadyInStatus: 'COMPANY_ALREADY_IN_STATUS',
  identityChanged: 'COMPANY_IDENTITY_CHANGED',
} as const;

export const COMPANY_NOT_FOUND = 'Entreprise introuvable.';

const ALREADY_MESSAGES: Record<ReviewTarget, string> = {
  APPROVED: 'Cette entreprise est déjà approuvée.',
  REJECTED: 'Cette entreprise est déjà refusée.',
};

/** Raison de refuser la décision (null : autorisée). */
export function reviewRefusal(
  current: CompanyStatus,
  target: ReviewTarget,
): string | null {
  return current === target ? ALREADY_MESSAGES[target] : null;
}

/** Colonnes à enregistrer pour une décision (motif effacé lors d'une approbation). */
export function reviewData(
  target: ReviewTarget,
  reason: string | undefined,
  now: Date,
): { status: ReviewTarget; rejectionReason: string | null; reviewedAt: Date } {
  return {
    status: target,
    rejectionReason: target === 'REJECTED' ? (reason ?? null) : null,
    reviewedAt: now,
  };
}
