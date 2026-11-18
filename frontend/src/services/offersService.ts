/**
 * Offres publiques : GET /api/offers.
 * Le serveur ne renvoie que les offres publiées, non expirées (date limite
 * incluse) et dont l'entreprise est validée.
 */
import type { ContractType, OfferType, WorkSchedule } from "../types/offer";
import { apiGet } from "./apiClient";
import type { ReferenceItem } from "./referenceService";

/** Une offre telle que renvoyée par l'API (mêmes noms de champs que le backend). */
export type PublicOffer = {
  id: string;
  title: string;
  type: OfferType;
  contractType: ContractType | null;
  workSchedule: WorkSchedule | null;
  duration: string | null;
  city: ReferenceItem;
  domain: ReferenceItem;
  description: string;
  deadline: string; // "AAAA-MM-JJ", date limite incluse
  skills: string[];
  featured: boolean;
  publishedAt: string; // date ISO complète
  company: { name: string; logoColor: string };
};

export type PublicOffersResult = {
  offers: PublicOffer[];
  /** Date du jour (côté serveur) utilisée pour exclure les offres expirées. */
  today: string;
};

/** Filtres acceptés par l'API ; un filtre absent ou vide n'est pas appliqué. */
export type PublicOfferFilters = {
  city?: string; // identifiant de ville ("boke")
  domain?: string; // identifiant de domaine ("finance")
  type?: OfferType;
  q?: string; // recherche : intitulé, entreprise, compétences
};

type PublicOffersResponse = {
  data: PublicOffer[];
  meta: { total: number; today: string };
};

export async function fetchPublicOffers(
  filters: PublicOfferFilters = {},
  signal?: AbortSignal,
): Promise<PublicOffersResult> {
  const response = await apiGet<PublicOffersResponse>(
    "/offers",
    { ...filters, q: filters.q?.trim() },
    signal,
  );
  return { offers: response.data, today: response.meta.today };
}
