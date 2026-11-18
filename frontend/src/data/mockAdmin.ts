/**
 * Données fictives de l'espace administrateur (état initial).
 * Plus tard, elles viendront de l'API NestJS (module Administration).
 */
import type { ModeratedOffer, PendingCompany } from "../types/admin";

export const initialPendingCompanies: PendingCompany[] = [
  {
    name: "Horoya Conseil",
    sector: "Conseil",
    city: "Conakry",
    date: "15 déc. 2026",
    status: "En attente",
  },
  {
    name: "Kindia Agro Services",
    sector: "Agriculture",
    city: "Kindia",
    date: "14 déc. 2026",
    status: "En attente",
  },
  {
    name: "Boké Transit",
    sector: "Logistique",
    city: "Boké",
    date: "12 déc. 2026",
    status: "En attente",
  },
];

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
