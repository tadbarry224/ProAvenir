/**
 * Règles métier des offres de l'espace entreprise, sous forme de fonctions pures
 * (sans base de données) : faciles à tester, réutilisées pour la création (B4.2)
 * et pour les changements de statut (B4.3).
 *
 * Elles reprennent celles du formulaire du frontend
 * (frontend/src/features/offers/validateOffer.ts) : mêmes limites, mêmes messages.
 * Ici, elles sont appliquées par le SERVEUR, donc impossibles à contourner.
 */
import type { ErrorDetail } from '../common/api-error.js';
import type {
  CompanyStatus,
  ContractType,
  OfferStatus,
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

/**
 * Codes d'erreur STABLES des routes /companies/me/offers (le texte des messages
 * peut évoluer, pas ces codes). Le frontend s'appuie sur eux :
 * - 403 NO_COMPANY / COMPANY_REJECTED / COMPANY_NOT_APPROVED : droits de l'entreprise ;
 * - 404 OFFER_NOT_FOUND : offre absente ou d'une autre entreprise ;
 * - 400 INVALID_OFFER_ID : identifiant mal formé dans l'adresse ;
 * - 400 VALIDATION_FAILED (voir common/api-error.ts) : données du formulaire, avec details ;
 * - 409 INVALID_STATUS_TRANSITION : changement impossible depuis l'état actuel ;
 * - 409 OFFER_NOT_PUBLISHABLE : contenu incomplet ou date limite passée, avec details.
 */
export const OFFER_ERROR_CODES = {
  noCompany: 'NO_COMPANY',
  companyRejected: 'COMPANY_REJECTED',
  companyNotApproved: 'COMPANY_NOT_APPROVED',
  offerNotFound: 'OFFER_NOT_FOUND',
  invalidOfferId: 'INVALID_OFFER_ID',
  invalidTransition: 'INVALID_STATUS_TRANSITION',
  notPublishable: 'OFFER_NOT_PUBLISHABLE',
} as const;

/** Refus d'une action : statut HTTP, code stable et message à afficher. */
export interface Refusal {
  statusCode: 403 | 409;
  code: string;
  message: string;
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
 * Renvoie null si c'est autorisé, sinon le refus (403).
 */
export function creationRefusal(
  companyStatus: CompanyStatus,
  status: CreationStatus,
): Refusal | null {
  if (companyStatus === 'REJECTED') {
    return {
      statusCode: 403,
      code: OFFER_ERROR_CODES.companyRejected,
      message: PERMISSION_MESSAGES.rejected,
    };
  }
  if (companyStatus === 'PENDING' && status === 'PUBLISHED') {
    return {
      statusCode: 403,
      code: OFFER_ERROR_CODES.companyNotApproved,
      message: PERMISSION_MESSAGES.pendingPublish,
    };
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
}): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const { type, contractType, duration } = input;
  if (contractType && contractType !== 'OTHER') {
    const allowed: ContractType[] =
      type === 'JOB' ? ['CDI', 'CDD'] : ['INTERNSHIP'];
    if (!allowed.includes(contractType)) {
      errors.push({
        field: 'contractType',
        message:
          type === 'JOB'
            ? 'Pour un emploi, le contrat doit être un CDI, un CDD ou « Autre ».'
            : 'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
      });
    }
  }
  if (contractType === 'CDI' && duration) {
    errors.push({
      field: 'duration',
      message: 'Un CDI n’a pas de durée : laissez la durée vide.',
    });
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
): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const description = input.description.trim();
  const fail = (field: string, message: string) =>
    errors.push({ field, message });
  if (!description) {
    fail('description', 'La description est obligatoire pour publier.');
  } else if (description.length < OFFER_RULES.descriptionMin) {
    fail(
      'description',
      `La description doit contenir au moins ${OFFER_RULES.descriptionMin} caractères pour publier (actuellement ${description.length}).`,
    );
  }
  if (!input.deadline) {
    fail('deadline', 'La date limite est obligatoire pour publier.');
  } else if (input.deadline < today) {
    fail('deadline', 'La date limite ne peut pas être dans le passé.');
  }
  return errors;
}

// --- Changements de statut (B4.3) -------------------------------------------

/** Statuts demandables : publier / rouvrir (PUBLISHED) ou clôturer (CLOSED). */
export const STATUS_TARGETS = ['PUBLISHED', 'CLOSED'] as const;
export type StatusTarget = (typeof STATUS_TARGETS)[number];

export const STATUS_MESSAGES = {
  rejectedReadOnly:
    'Votre entreprise a été refusée par l’administration : ses offres sont en lecture seule.',
  approvalRequired:
    'Votre entreprise doit être validée par l’administration avant de publier une offre.',
  alreadyPublished: 'Cette offre est déjà publiée.',
  alreadyClosed: 'Cette offre est déjà clôturée.',
  draftCannotClose:
    'Un brouillon ne peut pas être clôturé : publiez-le ou laissez-le en brouillon.',
} as const;

/**
 * Transitions autorisées :
 *   DRAFT     → PUBLISHED  (publier)
 *   PUBLISHED → CLOSED     (clôturer, même une offre expirée)
 *   CLOSED    → PUBLISHED  (rouvrir)
 * Tout le reste est refusé : clôturer un brouillon, republier une offre publiée,
 * reclôturer une offre clôturée. Le retour au brouillon n'existe pas.
 *
 * Droits selon le statut de l'entreprise :
 * - REJECTED : aucun changement (lecture seule) ;
 * - PENDING  : peut clôturer, jamais publier ni rouvrir ;
 * - APPROVED : tout.
 * Les conditions sur le CONTENU (description, date limite) sont vérifiées
 * ensuite par publicationErrors, pour toute publication ou réouverture.
 */
export function statusChangeRefusal(
  companyStatus: CompanyStatus,
  current: OfferStatus,
  target: StatusTarget,
): Refusal | null {
  // 403 : droits de l'entreprise ; 409 : état de l'offre.
  const transition = (message: string): Refusal => ({
    statusCode: 409,
    code: OFFER_ERROR_CODES.invalidTransition,
    message,
  });

  if (companyStatus === 'REJECTED') {
    return {
      statusCode: 403,
      code: OFFER_ERROR_CODES.companyRejected,
      message: STATUS_MESSAGES.rejectedReadOnly,
    };
  }
  if (current === target) {
    return transition(
      target === 'PUBLISHED'
        ? STATUS_MESSAGES.alreadyPublished
        : STATUS_MESSAGES.alreadyClosed,
    );
  }
  if (current === 'DRAFT' && target === 'CLOSED') {
    return transition(STATUS_MESSAGES.draftCannotClose);
  }
  if (target === 'PUBLISHED' && companyStatus !== 'APPROVED') {
    return {
      statusCode: 403,
      code: OFFER_ERROR_CODES.companyNotApproved,
      message: STATUS_MESSAGES.approvalRequired,
    };
  }
  return null;
}

/**
 * Dates à enregistrer pour une transition autorisée :
 * - publication d'un brouillon : publishedAt = maintenant ;
 * - réouverture : publishedAt d'origine CONSERVÉ, closedAt effacé ;
 * - clôture : closedAt = maintenant (publishedAt conservé).
 */
export function statusChangeDates(
  target: StatusTarget,
  publishedAt: Date | null,
  now: Date,
): { publishedAt: Date; closedAt: Date | null } {
  if (target === 'CLOSED') {
    return { publishedAt: publishedAt ?? now, closedAt: now };
  }
  return { publishedAt: publishedAt ?? now, closedAt: null };
}
