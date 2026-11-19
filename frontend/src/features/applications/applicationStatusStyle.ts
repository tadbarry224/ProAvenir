import type { ApplicationStatus } from "../../types/application";

/** Couleur de la pastille de statut d'une candidature. */
export const statusStyle: Record<ApplicationStatus, string> = {
  SENT: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  SHORTLISTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
};
