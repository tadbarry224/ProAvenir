/**
 * Règles métier des offres de l'espace entreprise, sous forme de fonctions pures
 * (sans base de données) : faciles à tester, réutilisées pour la création (B4.2)
 * et pour les changements de statut (B4.3).
 *
 * Elles reprennent celles du formulaire du frontend
 * (frontend/src/features/offers/validateOffer.ts) : mêmes limites, mêmes messages.
 * Ici, elles sont appliquées par le SERVEUR, donc impossibles à contourner.
 */
import type {
  CompanyStatus,
  ContractType,
  OfferType,
} from '../generated/prisma/enums.js';

export const OFFER_RULES = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 50,
  descriptionMax: 5000,
  skillsMax: 10,
  skillMaxLength: 40,
  durationMax: 50,
} as const;

/** Statuts possibles à la création (une offre ne naît jamais clôturée). */
export const CREATION_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type CreationStatus = (typeof CREATION_STATUSES)[number];

/** « Assistant   marketing » → « Assistant marketing ». */
export const collapseSpaces = (text: string): string =>
  text.trim().replace(/\s+/g, ' ');

/**
 * Nettoie une liste de compétences : espaces superflus retirés, éléments vides
 * supprimés, doublons retirés sans tenir compte des majuscules
 * (["Excel", " excel ", "Word"] → ["Excel", "Word"]). Même règle que le frontend.
 */
export function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const skill = collapseSpaces(raw);
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      result.push(skill);
    }
  }
  return result;
}

/** Vrai pour une date réelle au format "AAAA-MM-JJ" (refuse "2026-02-30"). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const PERMISSION_MESSAGES = {
  rejected:
    'Votre entreprise a été refusée par l’administration : vous ne pouvez pas créer d’offre.',
  pendingPublish:
    'Votre entreprise est en attente de validation : enregistrez l’offre en brouillon, vous pourrez la publier une fois l’entreprise validée.',
} as const;

/**
 * Droit de créer une offre selon le statut de l'entreprise :
 * - APPROVED : brouillon ou publication ;
 * - PENDING  : brouillon seulement ;
 * - REJECTED : aucune création (lecture seule).
 * Renvoie null si c'est autorisé, sinon le message du refus (403).
 */
export function creationRefusal(
  companyStatus: CompanyStatus,
  status: CreationStatus,
): string | null {
  if (companyStatus === 'REJECTED') return PERMISSION_MESSAGES.rejected;
  if (companyStatus === 'PENDING' && status === 'PUBLISHED') {
    return PERMISSION_MESSAGES.pendingPublish;
  }
  return null;
}

/**
 * Cohérence du contrat avec le type d'offre (mêmes règles que les contraintes
 * CHECK de la base, vérifiées ici pour renvoyer un message clair au lieu d'une
 * erreur serveur) :
 * - emploi : CDI, CDD ou Autre ; stage : convention de stage ou Autre ;
 * - un CDI n'a pas de durée.
 */
export function contractErrors(input: {
  type: OfferType;
  contractType?: ContractType | null;
  duration?: string | null;
}): string[] {
  const errors: string[] = [];
  const { type, contractType, duration } = input;
  if (contractType && contractType !== 'OTHER') {
    const allowed: ContractType[] =
      type === 'JOB' ? ['CDI', 'CDD'] : ['INTERNSHIP'];
    if (!allowed.includes(contractType)) {
      errors.push(
        type === 'JOB'
          ? 'Pour un emploi, le contrat doit être un CDI, un CDD ou « Autre ».'
          : 'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
      );
    }
  }
  if (contractType === 'CDI' && duration) {
    errors.push('Un CDI n’a pas de durée : laissez la durée vide.');
  }
  return errors;
}

/**
 * Conditions supplémentaires pour PUBLIER une offre (un brouillon peut rester
 * incomplet) : description d'au moins 50 caractères et date limite obligatoire,
 * aujourd'hui ou plus tard (jour de Conakry). Même règle que le frontend.
 */
export function publicationErrors(
  input: { description: string; deadline: string | null },
  today: string,
): string[] {
  const errors: string[] = [];
  const description = input.description.trim();
  if (!description) {
    errors.push('La description est obligatoire pour publier.');
  } else if (description.length < OFFER_RULES.descriptionMin) {
    errors.push(
      `La description doit contenir au moins ${OFFER_RULES.descriptionMin} caractères pour publier (actuellement ${description.length}).`,
    );
  }
  if (!input.deadline) {
    errors.push('La date limite est obligatoire pour publier.');
  } else if (input.deadline < today) {
    errors.push('La date limite ne peut pas être dans le passé.');
  }
  return errors;
}
