/**
 * Référentiels publics : villes et domaines.
 *   GET /api/cities  → { data: [{ id: "boke", name: "Boké" }, …] }
 *   GET /api/domains → { data: [{ id: "commerce", name: "Commerce" }, …] }
 */
import { apiGet } from "./apiClient";

/** Élément d'un référentiel : identifiant stable (envoyé à l'API) + libellé affiché. */
export type ReferenceItem = { id: string; name: string };

type ListResponse<T> = { data: T[] };

export async function fetchCities(signal?: AbortSignal): Promise<ReferenceItem[]> {
  return (await apiGet<ListResponse<ReferenceItem>>("/cities", undefined, signal)).data;
}

export async function fetchDomains(signal?: AbortSignal): Promise<ReferenceItem[]> {
  return (await apiGet<ListResponse<ReferenceItem>>("/domains", undefined, signal)).data;
}
