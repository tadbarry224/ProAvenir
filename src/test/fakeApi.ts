/**
 * Faux serveur pour les tests d'interface : remplace `fetch` par une fonction
 * qui répond comme l'API NestJS.
 *
 * - Offres, villes, domaines : réponses RÉELLES capturées sur le backend
 *   (src/test/fixtures/api-*.json, données de départ de la base), avec les
 *   mêmes filtres (city, domain, type, q) que GET /api/offers.
 * - Authentification : comptes de démonstration avec un mot de passe DE TEST
 *   (TEST_PASSWORD, propre aux tests). Le « cookie » de session est simulé par
 *   l'état `session`, qui survit à un nouvel affichage de l'application (F5).
 *   Comme la vraie API, les routes de session exigent l'en-tête CSRF et
 *   `credentials: "include"`.
 */
import { vi } from "vitest";
import offersResponse from "./fixtures/api-offers.json";
import citiesResponse from "./fixtures/api-cities.json";
import domainsResponse from "./fixtures/api-domains.json";
import type { PublicOffer } from "../services/offersService";
import type { SessionUser } from "../services/authService";
import type { UserRole } from "../types/auth";

/** Mot de passe des comptes du faux serveur (tests uniquement). */
export const TEST_PASSWORD = "MotDePasse-Test-1";

/** Comptes de démonstration connus du faux serveur. */
export const FAKE_USERS: Record<UserRole, SessionUser> = {
  CANDIDATE: {
    id: "u-candidate",
    email: "mariama.diallo@proavenir.test",
    fullName: "Mariama Diallo",
    role: "CANDIDATE",
    company: null,
  },
  COMPANY: {
    id: "u-company",
    email: "recrutement.kamsar-solutions@proavenir.test",
    fullName: "Recruteur Kamsar",
    role: "COMPANY",
    company: { id: "c-kamsar", name: "Kamsar Solutions", status: "APPROVED" },
  },
  ADMIN: {
    id: "u-admin",
    email: "admin@proavenir.test",
    fullName: "Administrateur",
    role: "ADMIN",
    company: null,
  },
};

type FakeApiOptions = {
  /** Simule un serveur injoignable (erreur réseau). */
  down?: boolean;
  /** Simule une erreur serveur (code HTTP) sur GET /api/offers. */
  offersStatus?: number;
  /** Session déjà ouverte au chargement (cookie présent) : rôle connecté. */
  session?: UserRole;
};

export type FakeApi = {
  requests: URL[];
  /** Utilisateur de la session « cookie » (null = pas de session). */
  readonly session: SessionUser | null;
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

/** Installe le faux serveur ; renvoie les URL appelées et l'état de session. */
export function installFakeApi(options: FakeApiOptions = {}): FakeApi {
  const requests: URL[] = [];
  const users = new Map(
    Object.values(FAKE_USERS).map((user) => [user.email, { user, password: TEST_PASSWORD }]),
  );
  let session: SessionUser | null = options.session ? FAKE_USERS[options.session] : null;
  let tokenCount = 0;

  const openSession = (user: SessionUser, status = 200) => {
    session = user;
    return json({ accessToken: `jeton-${++tokenCount}`, expiresIn: 900, user }, status);
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      requests.push(url);
      if (options.down) throw new TypeError("Failed to fetch");
      const path = url.pathname.replace(/^\/api/, "");
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : {};
      const headers = (init.headers ?? {}) as Record<string, string>;

      if (path.startsWith("/auth/") && method === "POST") {
        if (headers["X-ProAvenir-CSRF"] !== "1") return json({ message: "CSRF" }, 403);
        // Sans credentials: "include", le navigateur n'enverrait ni ne garderait le cookie.
        if (init.credentials !== "include") return json({ message: "Sans cookie" }, 401);
      }

      if (path === "/cities") return json(citiesResponse);
      if (path === "/domains") return json(domainsResponse);
      if (path === "/offers") {
        if (options.offersStatus) return json({}, options.offersStatus);
        return json(filterOffers(url.searchParams));
      }
      if (path === "/auth/login") {
        const account = users.get(String(body.email).trim().toLowerCase());
        if (!account || account.password !== body.password) {
          return json({ statusCode: 401, message: "E-mail ou mot de passe incorrect." }, 401);
        }
        return openSession(account.user);
      }
      if (path === "/auth/register") {
        if (!["CANDIDATE", "COMPANY"].includes(body.role)) {
          return json({ message: ["Le type de compte doit être Candidat ou Entreprise."] }, 400);
        }
        const email = String(body.email).trim().toLowerCase();
        if (users.has(email)) {
          return json({ message: "Un compte existe déjà avec cette adresse e-mail." }, 409);
        }
        const user: SessionUser = {
          id: `u-${users.size + 1}`,
          email,
          fullName: body.fullName,
          role: body.role,
          company:
            body.role === "COMPANY"
              ? { id: `c-${users.size + 1}`, name: body.companyName, status: "PENDING" }
              : null,
        };
        users.set(email, { user, password: body.password });
        return openSession(user, 201);
      }
      if (path === "/auth/refresh") {
        return session
          ? openSession(session)
          : json({ message: "Session expirée. Veuillez vous reconnecter." }, 401);
      }
      if (path === "/auth/logout") {
        session = null;
        return new Response(null, { status: 204 });
      }
      return json({ statusCode: 404 }, 404);
    }),
  );
  return {
    requests,
    get session() {
      return session;
    },
  };
}
