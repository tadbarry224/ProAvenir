/**
 * Règles des candidatures, sous forme de fonctions pures (sans base de données).
 *
 * Suivi d'une candidature par l'entreprise (une étape à la fois, jamais en arrière) :
 *   SENT (envoyée) → IN_REVIEW (en examen) → SHORTLISTED (présélectionnée) → ACCEPTED (retenue)
 * et REJECTED (refusée) possible depuis toute étape non finale.
 * ACCEPTED et REJECTED sont définitifs : le candidat a reçu une réponse.
 */
import type { ApplicationStatus } from '../generated/prisma/enums.js';

/** Étapes suivantes autorisées depuis chaque statut. */
export const NEXT_APPLICATION_STATUSES: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  SENT: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

/** Statuts qu'une entreprise peut choisir (jamais « envoyée », réservé au dépôt). */
export const APPLICATION_STATUS_TARGETS = [
  'IN_REVIEW',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
] as const;
export type ApplicationStatusTarget =
  (typeof APPLICATION_STATUS_TARGETS)[number];

/** Message au recruteur : facultatif, 1 000 caractères au plus. */
export const APPLICATION_MESSAGE_MAX = 1000;

/**
 * Codes d'erreur STABLES des routes de candidature (le frontend s'appuie sur eux) :
 * - 400 VALIDATION_FAILED / INVALID_APPLICATION_ID / INVALID_OFFER_ID ;
 * - 403 NO_CANDIDATE_PROFILE : compte candidat sans profil ;
 * - 403 COMPANY_REJECTED / NO_COMPANY : droits de l'entreprise ;
 * - 404 OFFER_NOT_AVAILABLE : offre inconnue ou plus publique (clôturée, expirée…) ;
 * - 404 APPLICATION_NOT_FOUND : candidature absente ou reçue par une autre entreprise ;
 * - 409 ALREADY_APPLIED : le candidat a déjà postulé à cette offre ;
 * - 409 INVALID_APPLICATION_TRANSITION : changement de statut impossible.
 */
export const APPLICATION_ERROR_CODES = {
  invalidApplicationId: 'INVALID_APPLICATION_ID',
  noCandidateProfile: 'NO_CANDIDATE_PROFILE',
  offerNotAvailable: 'OFFER_NOT_AVAILABLE',
  applicationNotFound: 'APPLICATION_NOT_FOUND',
  alreadyApplied: 'ALREADY_APPLIED',
  invalidTransition: 'INVALID_APPLICATION_TRANSITION',
} as const;

export const APPLICATION_MESSAGES = {
  noCandidateProfile: 'Aucun profil candidat n’est associé à ce compte.',
  offerNotAvailable:
    'Cette offre n’est plus disponible (clôturée, expirée ou retirée).',
  applicationNotFound: 'Candidature introuvable.',
  alreadyApplied: 'Vous avez déjà postulé à cette offre.',
  companyRejected:
    'Votre entreprise a été refusée par l’administration : le suivi des candidatures est en lecture seule.',
} as const;

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SENT: 'envoyée',
  IN_REVIEW: 'en examen',
  SHORTLISTED: 'présélectionnée',
  ACCEPTED: 'retenue',
  REJECTED: 'refusée',
};

/** Raison de refuser le changement de statut (null : autorisé). */
export function applicationTransitionRefusal(
  current: ApplicationStatus,
  target: ApplicationStatusTarget,
): string | null {
  if (NEXT_APPLICATION_STATUSES[current].includes(target)) return null;
  if (current === target) {
    return `Cette candidature est déjà ${STATUS_LABELS[current]}.`;
  }
  if (current === 'ACCEPTED' || current === 'REJECTED') {
    return `Cette candidature est déjà ${STATUS_LABELS[current]} : son statut est définitif.`;
  }
  return `Une candidature ${STATUS_LABELS[current]} ne peut pas passer à « ${STATUS_LABELS[target]} ».`;
}
