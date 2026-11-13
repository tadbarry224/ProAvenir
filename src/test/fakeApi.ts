/**
 * Faux serveur pour les tests d'interface : remplace `fetch` par une fonction
 * qui répond comme l'API NestJS, à partir de réponses RÉELLES capturées sur
 * le backend (src/test/fixtures/api-*.json, données de départ de la base).
 *
 * Les filtres (city, domain, type, q) reproduisent ceux de GET /api/offers,
 * pour que les parcours de filtrage restent testables sans serveur.
 */
import { vi } from "vitest";
import offersResponse from "./fixtures/api-offers.json";
import citiesResponse from "./fixtures/api-cities.json";
import domainsResponse from "./fixtures/api-domains.json";
import type { PublicOffer } from "../services/offersService";

type FakeApiOptions = {
  /** Simule un serveur injoignable (erreur réseau). */
  down?: boolean;
  /** Simule une erreur serveur (code HTTP) sur GET /api/offers. */
  offersStatus?: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function filterOffers(params: URLSearchParams) {
  const q = params.get("q")?.toLowerCase();
  const data = (offersResponse.data as PublicOffer[]).filter(
    (offer) =>
      (!params.get("city") || offer.city.id === params.get("city")) &&
      (!params.get("domain") || offer.domain.id === params.get("domain")) &&
      (!params.get("type") || offer.type === params.get("type")) &&
      (!q ||
        [offer.title, offer.company.name, ...offer.skills].some((text) =>
          text.toLowerCase().includes(q),
        )),
  );
  return { data, meta: { ...offersResponse.meta, total: data.length } };
}

/** Installe le faux serveur ; renvoie la liste des URL appelées (pour les vérifications). */
export function installFakeApi(options: FakeApiOptions = {}) {
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      requests.push(url);
      if (options.down) throw new TypeError("Failed to fetch");
      const path = url.pathname.replace(/^\/api/, "");
      if (path === "/cities") return json(citiesResponse);
      if (path === "/domains") return json(domainsResponse);
      if (path === "/offers") {
        if (options.offersStatus) return json({}, options.offersStatus);
        return json(filterOffers(url.searchParams));
      }
      return json({ statusCode: 404 }, 404);
    }),
  );
  return requests;
}
