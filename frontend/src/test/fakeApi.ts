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
 * - Offres de l'entreprise (/companies/me/offers) : point de départ = réponse
 *   RÉELLE capturée pour Kamsar Solutions (fixtures/api-company-offers.json).
 *   Le faux serveur applique les mêmes règles que le backend (jeton, rôle,
 *   statut de l'entreprise, transitions, codes d'erreur) avec une liste PAR
 *   entreprise, et la liste publique suit les publications et clôtures.
 */
import { vi } from "vitest";
import offersResponse from "./fixtures/api-offers.json";
import citiesResponse from "./fixtures/api-cities.json";
import domainsResponse from "./fixtures/api-domains.json";
import companyOffersResponse from "./fixtures/api-company-offers.json";
import type { PublicOffer } from "../services/offersService";
import type { CompanyOfferApi, CompanyStatus } from "../services/companyOffersService";
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
    company: { id: "c-kamsar", name: "Kamsar Solutions", status: "APPROVED", logoColor: "blue" },
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
  /** Statut de l'entreprise de démonstration (APPROVED par défaut). */
  companyStatus?: CompanyStatus;
};

/** Appel enregistré (pour vérifier ce que l'application envoie). */
export type FakeCall = {
  method: string;
  path: string;
  body: Record<string, unknown>;
  authorization: string | undefined;
};

export type FakeApi = {
  requests: URL[];
  /** Méthode, chemin, corps et en-tête Authorization de chaque appel. */
  calls: FakeCall[];
  /** Utilisateur de la session « cookie » (null = pas de session). */
  readonly session: SessionUser | null;
  /** Offres « en base » d'une entreprise (identifiant de l'entreprise). */
  companyOffers: (companyId: string) => CompanyOfferApi[];
  /** Fait échouer la prochaine requête (méthode + début du chemin). */
  failNext: (method: string, path: string, failure: FakeFailure) => void;
  /** Révoque la session et tous les jetons (ex. session expirée côté serveur). */
  revokeSession: () => void;
};

type ErrorDetail = { field: string; message: string };

/** Échec simulé : code HTTP seul, erreur réseau, ou réponse complète de l'API. */
export type FakeFailure = number | "network" | { status: number; body: unknown };

/** Forme d'un UUID (identifiant d'offre accepté par le backend). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Erreur au format de l'API : { statusCode, code?, message, details? }. */
const apiError = (
  statusCode: number,
  code: string | undefined,
  message: string | string[],
  details?: ErrorDetail[],
) =>
  json(
    { statusCode, ...(code ? { code } : {}), message, ...(details ? { details } : {}) },
    statusCode,
  );

/** Erreur de validation : message = liste des textes, details par champ. */
const validationError = (details: ErrorDetail[]) =>
  apiError(
    400,
    "VALIDATION_FAILED",
    details.map((detail) => detail.message),
    details,
  );

/** Date du jour du faux serveur (Date est figée par les tests). */
const fakeToday = () => new Date().toISOString().slice(0, 10);

const CREATE_FIELDS = [
  "status",
  "title",
  "type",
  "cityId",
  "domainId",
  "description",
  "deadline",
  "skills",
  "contractType",
  "workSchedule",
  "duration",
];

function filterOffers(params: URLSearchParams, all: PublicOffer[]) {
  const q = params.get("q")?.toLowerCase();
  const data = all.filter(
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

/** Conditions pour publier (mêmes messages que le backend). */
function publicationDetails(offer: { description?: unknown; deadline?: unknown }): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  const description = String(offer.description ?? "").trim();
  if (!description) {
    details.push({ field: "description", message: "La description est obligatoire pour publier." });
  } else if (description.length < 50) {
    details.push({
      field: "description",
      message: `La description doit contenir au moins 50 caractères pour publier (actuellement ${description.length}).`,
    });
  }
  if (!offer.deadline) {
    details.push({ field: "deadline", message: "La date limite est obligatoire pour publier." });
  } else if (String(offer.deadline) < fakeToday()) {
    details.push({ field: "deadline", message: "La date limite ne peut pas être dans le passé." });
  }
  return details;
}

/** Installe le faux serveur ; renvoie les appels reçus et des outils de test. */
export function installFakeApi(options: FakeApiOptions = {}): FakeApi {
  const requests: URL[] = [];
  const calls: FakeCall[] = [];
  // Copie des comptes : le statut de l'entreprise peut être choisi par le test.
  const accounts: Record<UserRole, SessionUser> = {
    ...FAKE_USERS,
    COMPANY: {
      ...FAKE_USERS.COMPANY,
      company: {
        ...FAKE_USERS.COMPANY.company!,
        status: options.companyStatus ?? FAKE_USERS.COMPANY.company!.status,
      },
    },
  };
  const users = new Map(
    Object.values(accounts).map((user) => [user.email, { user, password: TEST_PASSWORD }]),
  );
  let session: SessionUser | null = options.session ? accounts[options.session] : null;
  let tokenCount = 0;
  /** Jetons d'accès délivrés → utilisateur. */
  const tokens = new Map<string, SessionUser>();
  /** Offres « en base », par entreprise (départ : réponse réelle de Kamsar Solutions). */
  const offersByCompany = new Map<string, CompanyOfferApi[]>([
    [
      FAKE_USERS.COMPANY.company!.id,
      structuredClone(companyOffersResponse.data as CompanyOfferApi[]),
    ],
  ]);
  let offerCount = 0;
  const failures: { method: string; path: string; failure: FakeFailure }[] = [];

  const openSession = (user: SessionUser, status = 200) => {
    session = user;
    const accessToken = `jeton-${++tokenCount}`;
    tokens.set(accessToken, user);
    return json({ accessToken, expiresIn: 900, user }, status);
  };

  /** Entreprise d'un utilisateur, retrouvée par son identifiant. */
  const companyById = (id: string) =>
    [...users.values()].map(({ user }) => user.company).find((company) => company?.id === id);

  /** Même règle que le serveur : publiée, date limite non dépassée, entreprise validée. */
  const isVisible = (offer: CompanyOfferApi, status: CompanyStatus | undefined) =>
    status === "APPROVED" &&
    offer.status === "PUBLISHED" &&
    offer.deadline !== null &&
    offer.deadline >= fakeToday();

  /** Liste publique : offres fixes + état actuel des offres gérées par les entreprises. */
  const publicOffers = (): PublicOffer[] => {
    const fixture = offersResponse.data as PublicOffer[];
    const managed = [...offersByCompany.entries()].flatMap(([companyId, list]) =>
      list.map((offer) => ({ offer, company: companyById(companyId) })),
    );
    const managedIds = new Set(managed.map(({ offer }) => offer.id));
    const visible = managed
      .filter(({ offer, company }) => isVisible(offer, company?.status))
      .map(
        ({ offer, company }): PublicOffer =>
          fixture.find((item) => item.id === offer.id) ?? {
            id: offer.id,
            title: offer.title,
            type: offer.type,
            contractType: offer.contractType,
            workSchedule: offer.workSchedule,
            duration: offer.duration,
            city: offer.city,
            domain: offer.domain,
            description: offer.description,
            deadline: offer.deadline!,
            skills: offer.skills,
            featured: offer.featured,
            publishedAt: offer.publishedAt!,
            company: { name: company?.name ?? "", logoColor: "blue" },
          },
      );
    return [...fixture.filter((offer) => !managedIds.has(offer.id)), ...visible].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
    );
  };

  /** Routes /companies/me/offers, avec les mêmes contrôles que le backend. */
  const companyRoute = (
    path: string,
    method: string,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) => {
    const user = authorization?.startsWith("Bearer ")
      ? tokens.get(authorization.slice("Bearer ".length))
      : undefined;
    if (!user) return apiError(401, undefined, "Connexion requise.");
    if (user.role !== "COMPANY") return apiError(403, undefined, "Accès réservé.");
    const company = user.company;
    if (!company) {
      return apiError(403, "NO_COMPANY", "Aucune entreprise n’est associée à ce compte.");
    }
    const list = offersByCompany.get(company.id) ?? [];
    offersByCompany.set(company.id, list);
    const withVisibility = (offer: CompanyOfferApi) => ({
      ...offer,
      publiclyVisible: isVisible(offer, company.status),
    });

    if (path === "/companies/me/offers" && method === "GET") {
      const data = [...list]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
        .map(withVisibility);
      return json({
        data,
        meta: {
          total: data.length,
          today: fakeToday(),
          company: { name: company.name, status: company.status },
        },
      });
    }

    if (path === "/companies/me/offers" && method === "POST") {
      const unknownFields = Object.keys(body).filter((key) => !CREATE_FIELDS.includes(key));
      if (unknownFields.length) {
        return validationError(
          unknownFields.map((field) => ({ field, message: `property ${field} should not exist` })),
        );
      }
      if (company.status === "REJECTED") {
        return apiError(
          403,
          "COMPANY_REJECTED",
          "Votre entreprise a été refusée par l’administration : vous ne pouvez pas créer d’offre.",
        );
      }
      if (company.status === "PENDING" && body.status === "PUBLISHED") {
        return apiError(
          403,
          "COMPANY_NOT_APPROVED",
          "Votre entreprise est en attente de validation : enregistrez l’offre en brouillon, vous pourrez la publier une fois l’entreprise validée.",
        );
      }
      const city = citiesResponse.data.find((item) => item.id === body.cityId);
      const domain = domainsResponse.data.find((item) => item.id === body.domainId);
      const details: ErrorDetail[] = [
        ...(city ? [] : [{ field: "cityId", message: "Choisissez une ville dans la liste." }]),
        ...(domain ? [] : [{ field: "domainId", message: "Choisissez un domaine dans la liste." }]),
        ...(body.status === "PUBLISHED" ? publicationDetails(body) : []),
      ];
      if (details.length || !city || !domain) return validationError(details);
      const now = new Date().toISOString();
      const offer: CompanyOfferApi = {
        id: `00000000-0000-4000-8000-${String(++offerCount).padStart(12, "0")}`,
        title: String(body.title),
        type: body.type as CompanyOfferApi["type"],
        contractType: null,
        workSchedule: null,
        duration: null,
        status: body.status as CompanyOfferApi["status"],
        city,
        domain,
        description: String(body.description ?? ""),
        deadline: (body.deadline as string | null | undefined) ?? null,
        skills: (body.skills as string[] | undefined) ?? [],
        featured: false,
        publishedAt: body.status === "PUBLISHED" ? now : null,
        closedAt: null,
        createdAt: now,
        updatedAt: now,
        applicationsCount: 0,
        publiclyVisible: false,
      };
      list.push(offer);
      return json(withVisibility(offer), 201);
    }

    const match = /^\/companies\/me\/offers\/([^/]+)\/status$/.exec(path);
    if (match && method === "PATCH") {
      const offer = list.find((item) => item.id === decodeURIComponent(match[1]));
      if (!offer) return apiError(404, "OFFER_NOT_FOUND", "Offre introuvable.");
      const target = body.status;
      if (target !== "PUBLISHED" && target !== "CLOSED") {
        return validationError([
          {
            field: "status",
            message: "Le statut doit valoir PUBLISHED (publier ou rouvrir) ou CLOSED (clôturer).",
          },
        ]);
      }
      if (company.status === "REJECTED") {
        return apiError(
          403,
          "COMPANY_REJECTED",
          "Votre entreprise a été refusée par l’administration : ses offres sont en lecture seule.",
        );
      }
      if (offer.status === target) {
        return apiError(
          409,
          "INVALID_STATUS_TRANSITION",
          target === "PUBLISHED"
            ? "Cette offre est déjà publiée."
            : "Cette offre est déjà clôturée.",
        );
      }
      if (offer.status === "DRAFT" && target === "CLOSED") {
        return apiError(
          409,
          "INVALID_STATUS_TRANSITION",
          "Un brouillon ne peut pas être clôturé : publiez-le ou laissez-le en brouillon.",
        );
      }
      if (target === "PUBLISHED" && company.status !== "APPROVED") {
        return apiError(
          403,
          "COMPANY_NOT_APPROVED",
          "Votre entreprise doit être validée par l’administration avant de publier une offre.",
        );
      }
      if (target === "PUBLISHED") {
        const details = publicationDetails(offer);
        if (details.length) {
          return apiError(
            409,
            "OFFER_NOT_PUBLISHABLE",
            details.map((detail) => detail.message),
            details,
          );
        }
      }
      const now = new Date().toISOString();
      offer.status = target;
      offer.publishedAt ??= now;
      offer.closedAt = target === "CLOSED" ? now : null;
      offer.updatedAt = now;
      return json(withVisibility(offer));
    }
    return apiError(404, undefined, "Not Found");
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
      calls.push({ method, path, body, authorization: headers.Authorization });

      const failureIndex = failures.findIndex(
        (item) => item.method === method && path.startsWith(item.path),
      );
      if (failureIndex >= 0) {
        const [{ failure }] = failures.splice(failureIndex, 1);
        if (failure === "network") throw new TypeError("Failed to fetch");
        if (typeof failure === "object") return json(failure.body, failure.status);
        return apiError(failure, undefined, "Erreur simulée.");
      }

      if (path.startsWith("/auth/") && method === "POST") {
        if (headers["X-ProAvenir-CSRF"] !== "1") return json({ message: "CSRF" }, 403);
        // Sans credentials: "include", le navigateur n'enverrait ni ne garderait le cookie.
        if (init.credentials !== "include") return json({ message: "Sans cookie" }, 401);
      }

      if (path.startsWith("/companies/me/offers")) {
        return companyRoute(path, method, body, headers.Authorization);
      }
      if (path === "/cities") return json(citiesResponse);
      if (path === "/domains") return json(domainsResponse);
      if (path === "/offers") {
        if (options.offersStatus) return json({}, options.offersStatus);
        return json(filterOffers(url.searchParams, publicOffers()));
      }
      if (path.startsWith("/offers/") && method === "GET") {
        // Comme le backend : 400 si l'identifiant n'est pas un UUID, 404 si l'offre
        // n'est pas publique (brouillon, clôturée, expirée…) ou n'existe pas.
        const id = path.slice("/offers/".length);
        if (!UUID.test(id))
          return apiError(400, "INVALID_OFFER_ID", "Identifiant d’offre invalide.");
        if (options.offersStatus) return json({}, options.offersStatus);
        const offer = publicOffers().find((item) => item.id === id);
        return offer ? json(offer) : apiError(404, "OFFER_NOT_FOUND", "Offre introuvable.");
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
              ? {
                  id: `c-${users.size + 1}`,
                  name: body.companyName,
                  status: "PENDING",
                  logoColor: "blue",
                }
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
    calls,
    get session() {
      return session;
    },
    companyOffers: (companyId) => offersByCompany.get(companyId) ?? [],
    failNext: (method, path, failure) => failures.push({ method, path, failure }),
    revokeSession: () => {
      session = null;
      tokens.clear();
    },
  };
}
