/**
 * Offres de l'entreprise connectée (espace entreprise), routes protégées :
 *   GET   /api/companies/me/offers              → toutes ses offres + meta
 *   POST  /api/companies/me/offers              → crée un brouillon ou publie (201)
 *   PATCH /api/companies/me/offers/:id/status   → publier, clôturer ou rouvrir
 *
 * Chaque fonction reçoit la session (`useAuth()` convient tel quel) : le jeton est
 * lu en mémoire et renouvelé automatiquement s'il a expiré (authorizedRequest).
 * L'entreprise n'est JAMAIS envoyée : le serveur la déduit de la session.
 *
 * Erreurs : ApiError avec `status`, `code` stable et `details` par champ
 * (voir OFFER_ERROR_CODES et features/offers/companyOfferMapping.ts).
 */
import type { ContractType, OfferStatus, OfferType, WorkSchedule } from "../types/offer";
import { authorizedRequest, type AccessTokenSource } from "./apiClient";
import type { SessionUser } from "./authService";
import type { PublicOffer } from "./offersService";

/** Statut d'une entreprise (même type que dans la session). */
export type CompanyStatus = NonNullable<SessionUser["company"]>["status"];

/**
 * Offre telle que renvoyée à son entreprise. Mêmes champs que l'offre publique
 * (sauf l'entreprise, implicite), plus ce que seul le propriétaire voit.
 */
export type CompanyOfferApi = Omit<PublicOffer, "company" | "deadline" | "publishedAt"> & {
  status: OfferStatus;
  /** "AAAA-MM-JJ", null pour un brouillon sans date limite. */
  deadline: string | null;
  /** Dates ISO complètes (null si jamais publiée / non clôturée). */
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Nombre réel de candidatures (PostgreSQL). */
  applicationsCount: number;
  /** Visible en ce moment dans GET /api/offers (règle du serveur). */
  publiclyVisible: boolean;
};

export type CompanyOffersResult = {
  offers: CompanyOfferApi[];
  /** Date du jour à Conakry ("AAAA-MM-JJ"), référence pour l'expiration. */
  today: string;
  company: { name: string; status: CompanyStatus };
};

/** Statuts possibles à la création. */
export type CreationStatus = Extract<OfferStatus, "DRAFT" | "PUBLISHED">;
/** Statuts demandables : PUBLISHED (publier ou rouvrir) ou CLOSED (clôturer). */
export type StatusTarget = Extract<OfferStatus, "PUBLISHED" | "CLOSED">;

/** Corps de POST /api/companies/me/offers (identifiants de ville et de domaine). */
export type CreateOfferPayload = {
  status: CreationStatus;
  title: string;
  type: OfferType;
  cityId: string;
  domainId: string;
  description?: string;
  deadline?: string | null;
  skills?: string[];
  contractType?: ContractType | null;
  workSchedule?: WorkSchedule | null;
  duration?: string | null;
};

/**
 * Codes d'erreur stables de ces routes (identiques à backend/src/company-offers/
 * offer-rules.ts et common/api-error.ts). Le texte des messages peut changer,
 * pas ces codes.
 */
export const OFFER_ERROR_CODES = {
  validationFailed: "VALIDATION_FAILED", // 400, details par champ
  invalidOfferId: "INVALID_OFFER_ID", // 400
  noCompany: "NO_COMPANY", // 403
  companyRejected: "COMPANY_REJECTED", // 403
  companyNotApproved: "COMPANY_NOT_APPROVED", // 403
  offerNotFound: "OFFER_NOT_FOUND", // 404
  invalidTransition: "INVALID_STATUS_TRANSITION", // 409
  notPublishable: "OFFER_NOT_PUBLISHABLE", // 409, details par champ
} as const;

const BASE = "/companies/me/offers";

type ListResponse = {
  data: CompanyOfferApi[];
  meta: { total: number; today: string; company: { name: string; status: CompanyStatus } };
};

/** Toutes les offres de l'entreprise (brouillons, publiées, clôturées, expirées). */
export async function fetchCompanyOffers(
  session: AccessTokenSource,
  signal?: AbortSignal,
): Promise<CompanyOffersResult> {
  const response = await authorizedRequest<ListResponse>(session, BASE, { signal });
  return {
    offers: response.data,
    today: response.meta.today,
    company: response.meta.company,
  };
}

/** Crée une offre (brouillon, ou publication directe si l'entreprise est validée). */
export function createCompanyOffer(
  session: AccessTokenSource,
  payload: CreateOfferPayload,
): Promise<CompanyOfferApi> {
  return authorizedRequest<CompanyOfferApi>(session, BASE, { method: "POST", body: payload });
}

/** Publie un brouillon, clôture une offre publiée ou rouvre une offre clôturée. */
export function changeCompanyOfferStatus(
  session: AccessTokenSource,
  offerId: string,
  status: StatusTarget,
): Promise<CompanyOfferApi> {
  return authorizedRequest<CompanyOfferApi>(
    session,
    `${BASE}/${encodeURIComponent(offerId)}/status`,
    { method: "PATCH", body: { status } },
  );
}
