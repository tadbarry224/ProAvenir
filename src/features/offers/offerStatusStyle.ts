import { getDisplayStatus } from "./offerRules";

/** Couleur de la pastille de statut dans « Mes offres » (classes déjà utilisées dans le design). */
export const offerStatusStyle: Record<ReturnType<typeof getDisplayStatus>, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-blue-50 text-blue-700",
  CLOSED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-amber-50 text-amber-700",
};
