/**
 * Offres signalées, fictives (démonstration) : la modération réelle viendra plus tard.
 * Les entreprises à vérifier, elles, viennent de l’API (GET /api/admin/companies).
 */
import type { ModeratedOffer } from "../types/admin";

export const initialModeratedOffers: ModeratedOffer[] = [
  {
    title: "Agent commercial polyvalent",
    company: "Conakry Plus",
    reason: "Informations incomplètes",
    status: "À examiner",
  },
  {
    title: "Assistant de direction",
    company: "Dabola Services",
    reason: "Signalée par 2 utilisateurs",
    status: "À examiner",
  },
];
