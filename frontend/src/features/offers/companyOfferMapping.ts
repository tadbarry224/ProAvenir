/**
 * Conversions entre l'espace entreprise (formulaire, `Offer`) et l'API
 * /companies/me/offers, et traduction de ses erreurs pour l'affichage.
 *
 * Règle : aucune valeur inconnue n'est remplacée par une valeur fictive. Une
 * ville, un domaine ou un statut inattendu produit une erreur explicite.
 */
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import {
  OFFER_ERROR_CODES,
  type CompanyOfferApi,
  type CreateOfferPayload,
  type CreationStatus,
} from "../../services/companyOffersService";
import type { ReferenceItem } from "../../services/referenceService";
import {
  CONTRACT_TYPES,
  OFFER_CITIES,
  OFFER_DOMAINS,
  OFFER_STATUSES,
  OFFER_TYPES,
  WORK_SCHEDULES,
  type Offer,
  type OfferField,
  type OfferInput,
} from "../../types/offer";
import type { OfferErrors } from "./validateOffer";

/** Donnée de l'API que l'application ne sait pas afficher (ex. nouvelle ville en base). */
export class UnexpectedApiDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnexpectedApiDataError";
  }
}

/** Vérifie qu'une valeur appartient à une liste connue, sinon erreur explicite. */
function known<T extends string>(list: readonly T[], value: string, what: string): T {
  if ((list as readonly string[]).includes(value)) return value as T;
  throw new UnexpectedApiDataError(
    `Réponse inattendue du serveur : ${what} « ${value} » n’est pas connu(e) de l’application.`,
  );
}

const knownOrNull = <T extends string>(list: readonly T[], value: string | null, what: string) =>
  value === null ? null : known(list, value, what);

// --- API → affichage ---------------------------------------------------------

/**
 * Offre de l'API → `Offer` (format utilisé par l'espace entreprise et toJobView).
 * Les LIBELLÉS renvoyés par le serveur (city.name, domain.name) sont conservés :
 * l'affichage reste identique (« Conakry », « Ressources humaines »).
 */
export function companyOfferFromApi(api: CompanyOfferApi): Offer {
  return {
    id: api.id,
    title: api.title,
    type: known(OFFER_TYPES, api.type, "le type d’offre"),
    status: known(OFFER_STATUSES, api.status, "le statut"),
    city: known(OFFER_CITIES, api.city.name, "la ville"),
    domain: known(OFFER_DOMAINS, api.domain.name, "le domaine"),
    description: api.description,
    // Le formulaire représente « pas de date » par un texte vide.
    deadline: api.deadline ?? "",
    skills: api.skills,
    contractType: knownOrNull(CONTRACT_TYPES, api.contractType, "le type de contrat"),
    workSchedule: knownOrNull(WORK_SCHEDULES, api.workSchedule, "le rythme"),
    duration: api.duration,
    featured: api.featured,
    createdAt: api.createdAt,
    publishedAt: api.publishedAt,
    closedAt: api.closedAt,
    applicationsCount: api.applicationsCount,
    publiclyVisible: api.publiclyVisible,
  };
}

// --- Formulaire → API ----------------------------------------------------------

export type ReferenceLists = { cities: ReferenceItem[]; domains: ReferenceItem[] };

export type PayloadResult =
  | { ok: true; payload: CreateOfferPayload }
  | { ok: false; errors: OfferErrors };

/**
 * Données validées du formulaire (`validateOffer`) → corps de POST.
 * Le formulaire manipule des LIBELLÉS (« Conakry ») ; l'API attend des
 * IDENTIFIANTS (« conakry ») : on les retrouve dans les référentiels de l'API
 * (GET /api/cities et /api/domains). Libellé introuvable → erreur sur le champ.
 */
export function toCreateOfferPayload(
  input: OfferInput,
  status: CreationStatus,
  references: ReferenceLists,
): PayloadResult {
  const errors: OfferErrors = {};
  const idOf = (items: ReferenceItem[], label: string, field: "city" | "domain") => {
    if (items.length === 0) {
      errors[field] =
        field === "city"
          ? "La liste des villes n’est pas encore chargée. Réessayez dans un instant."
          : "La liste des domaines n’est pas encore chargée. Réessayez dans un instant.";
      return null;
    }
    const match = items.find((item) => item.name === label);
    if (!match) {
      errors[field] =
        field === "city"
          ? "Choisissez une ville dans la liste."
          : "Choisissez un domaine dans la liste.";
    }
    return match?.id ?? null;
  };

  const cityId = idOf(references.cities, input.city, "city");
  const domainId = idOf(references.domains, input.domain, "domain");
  if (!cityId || !domainId) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      status,
      title: input.title,
      type: input.type,
      cityId,
      domainId,
      description: input.description,
      deadline: input.deadline || null,
      skills: input.skills,
    },
  };
}

// --- Erreurs de l'API → affichage -------------------------------------------------

/** Champs de l'API → champs du formulaire (les autres n'ont pas de champ affiché). */
const API_FIELD_TO_FORM: Record<string, OfferField> = {
  title: "title",
  type: "type",
  cityId: "city",
  domainId: "domain",
  description: "description",
  deadline: "deadline",
  skills: "skills",
};

export type OfferErrorKind =
  | "validation" // 400 : formulaire à corriger (fieldErrors)
  | "session" // 401 : reconnexion nécessaire
  | "forbidden" // 403 : droits de l'entreprise (en attente, refusée…)
  | "notFound" // 404 : offre introuvable (supprimée, ou pas à cette entreprise)
  | "transition" // 409 : changement impossible depuis l'état actuel
  | "notPublishable" // 409 : contenu incomplet ou date limite passée (fieldErrors)
  | "network" // serveur injoignable / délai dépassé
  | "server"; // 5xx ou réponse inattendue

export type OfferActionError = {
  kind: OfferErrorKind;
  /** Code stable de l'API, s'il existe. */
  code?: string;
  /** Message en français prêt à afficher. */
  message: string;
  /** Erreurs à afficher sous les champs du formulaire (vide si aucune). */
  fieldErrors: OfferErrors;
};

function fieldErrorsOf(error: ApiError): OfferErrors {
  const fieldErrors: OfferErrors = {};
  for (const detail of error.details) {
    const field = API_FIELD_TO_FORM[detail.field];
    // Premier message par champ, comme validateOffer.
    if (field && !fieldErrors[field]) fieldErrors[field] = detail.message;
  }
  return fieldErrors;
}

/**
 * Traduit une erreur d'un appel à companyOffersService en information
 * d'affichage. Les erreurs qui ne viennent pas de l'API (bug de programmation)
 * ne sont pas masquées : elles sont relancées.
 */
export function offerErrorFromApi(error: unknown): OfferActionError {
  if (error instanceof UnexpectedApiDataError) {
    return { kind: "server", message: error.message, fieldErrors: {} };
  }
  if (!(error instanceof ApiError)) throw error;

  const base = { code: error.code, message: error.message, fieldErrors: {} };
  switch (error.status) {
    case null:
      return { ...base, kind: "network" };
    case 400:
      return { ...base, kind: "validation", fieldErrors: fieldErrorsOf(error) };
    case 401:
      return { ...base, kind: "session", message: SESSION_EXPIRED_MESSAGE };
    case 403:
      return { ...base, kind: "forbidden" };
    case 404:
      return { ...base, kind: "notFound" };
    case 409:
      return error.code === OFFER_ERROR_CODES.notPublishable
        ? { ...base, kind: "notPublishable", fieldErrors: fieldErrorsOf(error) }
        : { ...base, kind: "transition" };
    default:
      return { ...base, kind: "server" };
  }
}
