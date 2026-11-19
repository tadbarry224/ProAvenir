/**
 * Offres publiques et référentiels, chargés depuis l'API NestJS (PostgreSQL).
 *
 * Pages publiques. L'espace entreprise utilise `useOffers` (offres de l'entreprise
 * connectée, routes protégées).
 */
import { useMemo } from "react";
import { useApiData } from "../../lib/useApiData";
import {
  fetchPublicOffer,
  fetchPublicOffers,
  type PublicOfferFilters,
} from "../../services/offersService";
import { fetchCities, fetchDomains } from "../../services/referenceService";
import { ApiError } from "../../services/apiClient";
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
 * Une offre publique (page détail /offres/:id), relue sur le serveur à chaque
 * ouverture : un lien partagé ou un F5 fonctionne, et une offre clôturée entre-temps
 * n'est plus affichée.
 * `notFound` : l'offre n'existe pas ou n'est plus publique (404), ou l'adresse est
 * mal formée (400). Les autres échecs (serveur, réseau) restent des erreurs.
 */
export function usePublicOffer(id: string) {
  const result = useApiData(
    async (signal) => {
      try {
        return await fetchPublicOffer(id, signal);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 400))
          return null;
        throw error;
      }
    },
    [id],
  );
  const job = useMemo(() => (result.data ? publicOfferToJob(result.data) : null), [result.data]);
  return { ...result, job, notFound: result.status === "success" && result.data === null };
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
