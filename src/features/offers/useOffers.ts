/**
 * Hook qui centralise l'état des offres de l'ESPACE ENTREPRISE et les actions possibles.
 * Les pages publiques n'utilisent plus ce hook : elles lisent l'API (usePublicOffers).
 *
 * Il est appelé UNE seule fois, dans `App` : comme `App` reste toujours affiché,
 * les offres survivent aux changements de page.
 *
 * ⚠️ Mémoire temporaire seulement : un rafraîchissement de la page (F5) remet
 * les données fictives de départ. La vraie persistance viendra de PostgreSQL.
 *
 * Correspondance avec la future API NestJS :
 *   (offres publiques     → GET   /api/offers : déjà branché, voir usePublicOffers)
 *   getCompanyOffers(id)  → GET   /companies/me/offers
 *   createOffer(...)      → POST  /offers
 *   changeOfferStatus(id) → PATCH /offers/:id/status
 */
import { useState } from "react";
import { mockOffers } from "../../data/mockOffers";
import type { Offer, OfferInput, OfferStatus } from "../../types/offer";
import { buildOffer, changeStatus } from "./offerRules";
import { todayIsoDate } from "../../lib/dates";

export function useOffers(initialOffers: Offer[] = mockOffers) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const today = todayIsoDate();

  /** Toutes les offres d'une entreprise (brouillons, clôturées et expirées comprises). */
  const getCompanyOffers = (companyId: number) =>
    offers.filter((offer) => offer.companyId === companyId);

  /** Ajoute une offre ; les plus récentes apparaissent en premier. */
  const createOffer = (companyId: number, input: OfferInput, status: OfferStatus) => {
    const offer = buildOffer(input, { id: Date.now(), companyId, status, now: new Date() });
    setOffers((items) => [offer, ...items]);
    return offer;
  };

  /**
   * Publier / Clôturer / Réouvrir.
   * Renvoie `null` si tout s'est bien passé, sinon le message d'erreur à afficher.
   */
  const changeOfferStatus = (offerId: number): string | null => {
    const offer = offers.find((item) => item.id === offerId);
    if (!offer) return "Cette offre est introuvable.";
    const result = changeStatus(offer, today, new Date());
    if (!result.ok) return result.message;
    setOffers((items) => items.map((item) => (item.id === offerId ? result.offer : item)));
    return null;
  };

  return { offers, today, getCompanyOffers, createOffer, changeOfferStatus };
}
