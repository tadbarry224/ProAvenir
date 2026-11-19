/**
 * Données de l'espace administrateur.
 */

/** Statut de vérification d'une entreprise (mêmes valeurs que l'API). */
export type CompanyReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export const COMPANY_REVIEW_STATUS_LABELS: Record<CompanyReviewStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};

/** Entreprise affichée dans « Entreprises à vérifier » (données réelles de l'API). */
export type AdminCompanyView = {
  id: string;
  name: string;
  sector: string; // « Secteur non renseigné » si vide
  city: string; // « Ville non renseignée » si vide
  date: string; // date d'inscription : « 15 déc. 2026 »
  status: CompanyReviewStatus;
  statusLabel: string; // « En attente », « Approuvée » ou « Refusée »
  rejectionReason: string | null;
};
