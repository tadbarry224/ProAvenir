/**
 * Règles métier des offres, sous forme de fonctions pures (sans React).
 *
 * IMPORTANT : ces règles s'exécutent aujourd'hui dans le navigateur, ce qui
 * n'apporte AUCUNE sécurité. Quand l'API NestJS existera, le serveur devra
 * appliquer les mêmes règles (ne jamais renvoyer un brouillon au public, etc.).
 */
import type { Offer, OfferDisplayStatus, OfferInput, OfferStatus } from "../../types/offer";
import { toOfferFormValues, validateOffer } from "./validateOffer";

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

/** Crée une nouvelle offre à partir des données validées du formulaire. */
export function buildOffer(
  input: OfferInput,
  options: { id: string; companyId: number; status: OfferStatus; now: Date },
): Offer {
  const timestamp = options.now.toISOString();
  return {
    ...input,
    id: options.id,
    companyId: options.companyId,
    status: options.status,
    createdAt: timestamp,
    publishedAt: options.status === "PUBLISHED" ? timestamp : null,
  };
}

export type StatusChangeResult = { ok: true; offer: Offer } | { ok: false; message: string };

/**
 * Applique le changement de statut d'une offre.
 * Toute (re)mise en ligne passe par la validation de publication :
 * un brouillon incomplet ou une offre dont la date est dépassée ne peut pas être publié.
 */
export function changeStatus(offer: Offer, today: string, now: Date): StatusChangeResult {
  const target = nextStatus(offer.status);

  if (target === "PUBLISHED") {
    const result = validateOffer(toOfferFormValues(offer), "publish", today);
    if (!result.ok) {
      return {
        ok: false,
        message: `« ${offer.title} » ne peut pas être publiée : ${Object.values(result.errors).join(" ")}`,
      };
    }
    return {
      ok: true,
      // On conserve la date de première publication si elle existe déjà.
      offer: { ...offer, status: target, publishedAt: offer.publishedAt ?? now.toISOString() },
    };
  }

  return { ok: true, offer: { ...offer, status: target } };
}
