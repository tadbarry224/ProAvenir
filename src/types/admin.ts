/**
 * Données de l'espace administrateur (démonstration).
 */

/** Entreprise en attente de vérification par un administrateur. */
export type PendingCompany = {
  name: string;
  sector: string;
  city: string;
  date: string;
  status: string; // « En attente », « Approuvée » ou « Refusée »
};

/** Offre signalée, à modérer par un administrateur. */
export type ModeratedOffer = {
  title: string;
  company: string;
  reason: string;
  status: string; // « À examiner », « Suspendue » ou « Maintenue »
};
