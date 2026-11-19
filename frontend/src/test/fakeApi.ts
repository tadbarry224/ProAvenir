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
// Entreprises vues par l'administration : construites à partir de backend/prisma/seed-data.ts
// (jamais capturées depuis la base de développement, qui contient de vrais comptes).
import adminCompaniesResponse from "./fixtures/api-admin-companies.json";
import type { AdminCompanyApi } from "../services/adminCompaniesService";
import type {
  CandidateApplicationApi,
  ReceivedApplicationApi,
} from "../services/applicationsService";
import { NEXT_APPLICATION_STATUSES, type ApplicationStatus } from "../types/application";

/** Candidature « en base » du faux serveur. */
export type FakeApplication = {
  id: string;
  offerId: string;
  candidateEmail: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  cvFileName: string | null;
};

/**
 * Profils candidats et candidatures de départ, recopiés de backend/prisma/seed-data.ts
 * (jamais de la base de développement, qui contient de vrais comptes).
 */
const FAKE_CANDIDATE_PROFILES: Record<string, ReceivedApplicationApi["candidate"]> = {
  "mariama.diallo@proavenir.test": {
    fullName: "Mariama Diallo",
    email: "mariama.diallo@proavenir.test",
    city: { id: "conakry", name: "Conakry" },
    education: "Licence en Communication — Université de Sonfonia",
    skills: ["Communication", "Réseaux sociaux", "Canva", "Excel"],
  },
  "abdoulaye.bah@proavenir.test": {
    fullName: "Abdoulaye Bah",
    email: "abdoulaye.bah@proavenir.test",
    city: null,
    education: null,
    skills: [],
  },
};

const seedApplication = (
  n: number,
  offer: number,
  candidateEmail: string,
  status: ApplicationStatus,
  createdAt: string,
): FakeApplication => ({
  id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  offerId: `30000000-0000-4000-8000-${String(offer).padStart(12, "0")}`,
  candidateEmail,
  status,
  message: null,
  createdAt,
  updatedAt: createdAt,
  cvFileName: candidateEmail.startsWith("mariama") ? "CV_Mariama_Diallo.pdf" : null,
});

const SEED_APPLICATIONS: FakeApplication[] = [
  seedApplication(1, 1, "mariama.diallo@proavenir.test", "IN_REVIEW", "2026-12-12T12:00:00.000Z"),
  seedApplication(2, 2, "mariama.diallo@proavenir.test", "SHORTLISTED", "2026-12-08T12:00:00.000Z"),
  seedApplication(3, 3, "mariama.diallo@proavenir.test", "SENT", "2026-12-01T12:00:00.000Z"),
  seedApplication(4, 1, "abdoulaye.bah@proavenir.test", "SENT", "2026-12-11T12:00:00.000Z"),
];
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
  /** Motif renvoyé quand l.entreprise de démonstration est refusée. */
  rejectionReason?: string;
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
  /** Entreprises « en base » vues par l'administration (après les décisions). */
  adminCompanies: () => AdminCompanyApi[];
  /** Candidatures « en base » (après les dépôts et les changements de statut). */
  applications: () => FakeApplication[];
  /** Décision de l’administration sur l’entreprise de démonstration, pendant la session. */
  setCompanyStatus: (status: CompanyStatus) => void;
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
  /** Entreprises « en base » pour l'administration (départ : seed). */
  const adminCompanies = structuredClone(adminCompaniesResponse.data) as AdminCompanyApi[];
  /** Candidatures « en base » (départ : seed). */
  const applications: FakeApplication[] = structuredClone(SEED_APPLICATIONS);
  let applicationCount = 0;

  /** Offre connue du faux serveur : liste publique, ou offre gérée par une entreprise. */
  const offerInfo = (offerId: string) => {
    const publicOffer = publicOffers().find((offer) => offer.id === offerId);
    if (publicOffer) return { offer: publicOffer, visible: true };
    for (const [companyId, list] of offersByCompany) {
      const managed = list.find((offer) => offer.id === offerId);
      if (managed) {
        const company = companyById(companyId);
        return {
          offer: { ...managed, company: { name: company?.name ?? "", logoColor: "blue" } },
          visible: false,
        };
      }
    }
    throw new Error(`Offre inconnue du faux serveur : ${offerId}`);
  };
  const toCandidateView = (application: FakeApplication): CandidateApplicationApi => {
    const { offer, visible } = offerInfo(application.offerId);
    return {
      id: application.id,
      status: application.status,
      message: application.message,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      offer: {
        id: offer.id,
        title: offer.title,
        type: offer.type,
        city: offer.city,
        company: offer.company,
        publiclyVisible: visible,
      },
    };
  };
  const toReceivedView = (application: FakeApplication): ReceivedApplicationApi => {
    const { offer } = offerInfo(application.offerId);
    return {
      id: application.id,
      status: application.status,
      message: application.message,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      cvFileName: application.cvFileName,
      offer: { id: offer.id, title: offer.title },
      candidate: FAKE_CANDIDATE_PROFILES[application.candidateEmail] ?? {
        fullName: application.candidateEmail,
        email: application.candidateEmail,
        city: null,
        education: null,
        skills: [],
      },
    };
  };
  const newest = (a: FakeApplication, b: FakeApplication) =>
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

  /** Routes de candidature, avec les mêmes contrôles que le backend. */
  const applicationsRoute = (
    path: string,
    method: string,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) => {
    const user = authorization?.startsWith("Bearer ")
      ? tokens.get(authorization.slice("Bearer ".length))
      : undefined;
    if (!user) return apiError(401, undefined, "Connexion requise.");

    if (path === "/candidates/me/applications") {
      if (user.role !== "CANDIDATE") return apiError(403, undefined, "Accès réservé.");
      const mine = applications.filter((a) => a.candidateEmail === user.email);
      if (method === "GET") {
        const data = [...mine].sort(newest).map(toCandidateView);
        return json({ data, meta: { total: data.length } });
      }
      const offerId = String(body.offerId ?? "");
      if (!UUID.test(offerId)) {
        return apiError(400, "VALIDATION_FAILED", ["Choisissez une offre valide."]);
      }
      if (!publicOffers().some((offer) => offer.id === offerId)) {
        return apiError(
          404,
          "OFFER_NOT_AVAILABLE",
          "Cette offre n’est plus disponible (clôturée, expirée ou retirée).",
        );
      }
      if (mine.some((a) => a.offerId === offerId)) {
        return apiError(409, "ALREADY_APPLIED", "Vous avez déjà postulé à cette offre.");
      }
      const now = new Date().toISOString();
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const application: FakeApplication = {
        id: `50000000-0000-4000-8000-${String(++applicationCount).padStart(12, "0")}`,
        offerId,
        candidateEmail: user.email,
        status: "SENT",
        message: message || null,
        createdAt: now,
        updatedAt: now,
        cvFileName: null,
      };
      applications.push(application);
      return json(toCandidateView(application), 201);
    }

    // /companies/me/applications et /companies/me/applications/:id/status
    if (user.role !== "COMPANY") return apiError(403, undefined, "Accès réservé.");
    const company = user.company;
    if (!company) {
      return apiError(403, "NO_COMPANY", "Aucune entreprise n’est associée à ce compte.");
    }
    const ownOfferIds = new Set((offersByCompany.get(company.id) ?? []).map((offer) => offer.id));
    const received = applications.filter((a) => ownOfferIds.has(a.offerId));
    if (path === "/companies/me/applications" && method === "GET") {
      const data = [...received].sort(newest).map(toReceivedView);
      return json({ data, meta: { total: data.length } });
    }
    const match = /^\/companies\/me\/applications\/([^/]+)\/status$/.exec(path);
    if (!match || method !== "PATCH") return apiError(404, undefined, "Not Found");
    if (!UUID.test(match[1])) {
      return apiError(400, "INVALID_APPLICATION_ID", "Identifiant de candidature invalide.");
    }
    if (company.status === "REJECTED") {
      return apiError(
        403,
        "COMPANY_REJECTED",
        "Votre entreprise a été refusée par l’administration : le suivi des candidatures est en lecture seule.",
      );
    }
    const application = received.find((a) => a.id === match[1]);
    if (!application) return apiError(404, "APPLICATION_NOT_FOUND", "Candidature introuvable.");
    const target = body.status as ApplicationStatus;
    if (!NEXT_APPLICATION_STATUSES[application.status].includes(target)) {
      return apiError(
        409,
        "INVALID_APPLICATION_TRANSITION",
        "Ce changement de statut n’est pas possible.",
      );
    }
    application.status = target;
    application.updatedAt = new Date().toISOString();
    return json(toReceivedView(application));
  };

  /** Routes /admin/companies, avec les mêmes contrôles que le backend. */
  const adminRoute = (
    path: string,
    method: string,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) => {
    const user = authorization?.startsWith("Bearer ")
      ? tokens.get(authorization.slice("Bearer ".length))
      : undefined;
    if (!user) return apiError(401, undefined, "Connexion requise.");
    if (user.role !== "ADMIN") return apiError(403, undefined, "Accès réservé.");

    if (path === "/admin/companies" && method === "GET") {
      const order = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
      const data = [...adminCompanies].sort(
        (a, b) =>
          order[a.status] - order[b.status] ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
      const pending = data.filter((company) => company.status === "PENDING").length;
      return json({ data, meta: { total: data.length, pending } });
    }
    const match = /^\/admin\/companies\/([^/]+)\/status$/.exec(path);
    if (!match || method !== "PATCH") return apiError(404, undefined, "Not Found");
    if (!UUID.test(match[1])) {
      return apiError(400, "INVALID_COMPANY_ID", "Identifiant d’entreprise invalide.");
    }
    const company = adminCompanies.find((item) => item.id === match[1]);
    if (!company) return apiError(404, "COMPANY_NOT_FOUND", "Entreprise introuvable.");
    const reason = typeof body.reason === "string" ? body.reason.replace(/\s+/g, " ").trim() : "";
    if (body.status !== "APPROVED" && body.status !== "REJECTED") {
      return apiError(400, "VALIDATION_FAILED", [
        "Le statut doit valoir APPROVED (approuver) ou REJECTED (refuser).",
      ]);
    }
    if (body.status === "REJECTED" && (reason.length < 5 || reason.length > 500)) {
      return apiError(400, "VALIDATION_FAILED", [
        reason
          ? "Le motif du refus doit contenir entre 5 et 500 caractères."
          : "Le motif du refus est obligatoire.",
      ]);
    }
    if (body.status === "APPROVED" && reason) {
      return apiError(400, "VALIDATION_FAILED", ["Une approbation ne prend pas de motif."]);
    }
    if (company.status === body.status) {
      return apiError(
        409,
        "COMPANY_ALREADY_IN_STATUS",
        body.status === "APPROVED"
          ? "Cette entreprise est déjà approuvée."
          : "Cette entreprise est déjà refusée.",
      );
    }
    company.status = body.status;
    company.rejectionReason = body.status === "REJECTED" ? reason : null;
    company.reviewedAt = new Date().toISOString();
    return json(company);
  };
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
          company: {
            name: company.name,
            status: company.status,
            rejectionReason:
              company.status === "REJECTED"
                ? (options.rejectionReason ?? "Dossier incomplet.")
                : null,
          },
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
      if (
        path.startsWith("/candidates/me/applications") ||
        path.startsWith("/companies/me/applications")
      ) {
        return applicationsRoute(path, method, body, headers.Authorization);
      }
      if (path.startsWith("/admin/companies")) {
        return adminRoute(path, method, body, headers.Authorization);
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
    adminCompanies: () => adminCompanies,
    applications: () => applications,
    setCompanyStatus: (status) => {
      accounts.COMPANY.company!.status = status;
    },
    failNext: (method, path, failure) => failures.push({ method, path, failure }),
    revokeSession: () => {
      session = null;
      tokens.clear();
    },
  };
}
