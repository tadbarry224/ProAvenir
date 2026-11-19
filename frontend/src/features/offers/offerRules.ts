/**
 * Règles métier des offres, sous forme de fonctions pures (sans React).
 *
 * Elles servent uniquement à l'AFFICHAGE (statut « Expirée », boutons désactivés…).
 * La sécurité est assurée par l'API NestJS, qui applique les mêmes règles
 * (backend/src/company-offers/offer-rules.ts) : le navigateur ne décide de rien.
 */
import type { Offer, OfferDisplayStatus, OfferStatus } from "../../types/offer";

/** Vrai si la date limite (AAAA-MM-JJ) est strictement avant aujourd'hui. */
export function isExpired(offer: Offer, today: string): boolean {
  return offer.deadline !== "" && offer.deadline < today;
}

/**
 * Une offre est visible publiquement seulement si :
 * - elle est publiée (ni brouillon, ni clôturée),
 * - et sa date limite n'est pas dépassée (le jour même reste valable).
 */
export function isPubliclyVisible(offer: Offer, today: string): boolean {
  return offer.status === "PUBLISHED" && offer.deadline !== "" && !isExpired(offer, today);
}

/** Statut à afficher dans l'espace entreprise (ajoute « Expirée », qui est calculé). */
export function getDisplayStatus(offer: Offer, today: string): OfferDisplayStatus {
  if (offer.status === "PUBLISHED" && isExpired(offer, today)) return "EXPIRED";
  return offer.status;
}

/** Statut suivant pour le bouton « Publier / Clôturer / Réouvrir ». */
export function nextStatus(status: OfferStatus): OfferStatus {
  return status === "PUBLISHED" ? "CLOSED" : "PUBLISHED";
}

// --- Droits de l'entreprise (mêmes règles que le serveur, pour l'affichage) ---

export const COMPANY_STATUS_MESSAGES = {
  pendingPublish:
    "Votre entreprise est en attente de validation : vous pouvez enregistrer un brouillon. La publication sera possible une fois l’entreprise validée.",
  rejected:
    "Votre entreprise a été refusée par l’administration : vos offres sont en lecture seule.",
} as const;

type CompanyStatusValue = "PENDING" | "APPROVED" | "REJECTED";

/** Raison pour laquelle l'entreprise ne peut pas CRÉER d'offre (null : autorisé). */
export function creationBlockedReason(companyStatus: CompanyStatusValue | null): string | null {
  return companyStatus === "REJECTED" ? COMPANY_STATUS_MESSAGES.rejected : null;
}

/** Raison pour laquelle l'entreprise ne peut pas PUBLIER (null : autorisé). */
export function publicationBlockedReason(companyStatus: CompanyStatusValue | null): string | null {
  if (companyStatus === "REJECTED") return COMPANY_STATUS_MESSAGES.rejected;
  if (companyStatus === "PENDING") return COMPANY_STATUS_MESSAGES.pendingPublish;
  return null;
}

/**
 * Raison pour laquelle le bouton « Publier / Clôturer / Réouvrir » d'une offre est
 * désactivé (null : autorisé). Comme le serveur : en attente, on peut clôturer
 * mais ni publier ni rouvrir ; refusée, aucune modification.
 */
export function statusActionBlockedReason(
  companyStatus: CompanyStatusValue | null,
  offerStatus: OfferStatus,
): string | null {
  if (companyStatus === "REJECTED") return COMPANY_STATUS_MESSAGES.rejected;
  if (nextStatus(offerStatus) === "PUBLISHED") return publicationBlockedReason(companyStatus);
  return null;
}
