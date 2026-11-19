/**
 * Offres publiques et référentiels, chargés depuis l'API NestJS (PostgreSQL).
 *
 * Pages publiques. L'espace entreprise utilise `useOffers` (offres de l'entreprise
 * connectée, routes protégées).
 */
import { useMemo } from "react";
import { useApiData } from "../../lib/useApiData";
import { fetchPublicOffers, type PublicOfferFilters } from "../../services/offersService";
import { fetchCities, fetchDomains } from "../../services/referenceService";
import { publicOfferToJob } from "./toJobView";

/**
 * Offres publiques correspondant aux filtres, déjà converties au format d'affichage.
 * `filters = null` : on attend (par exemple que les villes soient chargées).
 */
export function usePublicOffers(filters: PublicOfferFilters | null = {}) {
  const { city, domain, type, q } = filters ?? {};
  const result = useApiData(
    filters ? (signal) => fetchPublicOffers({ city, domain, type, q }, signal) : null,
    [filters === null, city, domain, type, q],
  );
  const jobs = useMemo(() => result.data?.offers.map(publicOfferToJob) ?? [], [result.data]);
  return { ...result, jobs, today: result.data?.today };
}

/**
 * Villes et domaines (options des filtres et du formulaire), chargés ensemble.
 * `enabled = false` : on attend (aucune requête), ex. espace entreprise non affiché.
 */
export function useReferenceLists(enabled = true) {
  return useApiData(
    enabled
      ? async (signal) => {
          const [cities, domains] = await Promise.all([fetchCities(signal), fetchDomains(signal)]);
          return { cities, domains };
        }
      : null,
    [enabled],
  );
}
