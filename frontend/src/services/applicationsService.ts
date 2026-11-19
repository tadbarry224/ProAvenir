/**
 * Candidatures (étape B5), routes protégées :
 *   Candidat   : GET  /api/candidates/me/applications        → ses candidatures
 *                POST /api/candidates/me/applications        → postuler (201)
 *   Entreprise : GET   /api/companies/me/applications        → candidatures reçues
 *                PATCH /api/companies/me/applications/:id/status
 *
 * Le candidat et l'entreprise sont déduits de la session par le serveur : aucun
 * identifiant de compte n'est envoyé. Chaque fonction reçoit la session (`useAuth()`).
 */
import type { ApplicationStatus } from "../types/application";
import type { OfferType } from "../types/offer";
import { authorizedRequest, type AccessTokenSource } from "./apiClient";
import type { ReferenceItem } from "./referenceService";

/** Candidature vue par le candidat (mêmes champs que le backend). */
export type CandidateApplicationApi = {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  offer: {
    id: string;
    title: string;
    type: OfferType;
    city: ReferenceItem;
    company: { name: string; logoColor: string };
    publiclyVisible: boolean;
  };
};

/** Candidature reçue par l'entreprise (mêmes champs que le backend). */
export type ReceivedApplicationApi = {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  cvFileName: string | null;
  offer: { id: string; title: string };
  candidate: {
    fullName: string;
    email: string;
    city: ReferenceItem | null;
    education: string | null;
    skills: string[];
  };
};

/** Statuts qu'une entreprise peut choisir. */
export type ApplicationStatusTarget = Exclude<ApplicationStatus, "SENT">;

/** Codes d'erreur stables (identiques à backend/src/applications/application-rules.ts). */
export const APPLICATION_ERROR_CODES = {
  validationFailed: "VALIDATION_FAILED", // 400
  invalidApplicationId: "INVALID_APPLICATION_ID", // 400
  noCandidateProfile: "NO_CANDIDATE_PROFILE", // 403
  companyRejected: "COMPANY_REJECTED", // 403
  offerNotAvailable: "OFFER_NOT_AVAILABLE", // 404
  applicationNotFound: "APPLICATION_NOT_FOUND", // 404
  alreadyApplied: "ALREADY_APPLIED", // 409
  invalidTransition: "INVALID_APPLICATION_TRANSITION", // 409
} as const;

/** Longueur maximale du message au recruteur. */
export const APPLICATION_MESSAGE_MAX = 1000;

const CANDIDATE_BASE = "/candidates/me/applications";
const COMPANY_BASE = "/companies/me/applications";

type ListResponse<T> = { data: T[]; meta: { total: number } };

export async function fetchMyApplications(
  session: AccessTokenSource,
  signal?: AbortSignal,
): Promise<CandidateApplicationApi[]> {
  const response = await authorizedRequest<ListResponse<CandidateApplicationApi>>(
    session,
    CANDIDATE_BASE,
    { signal },
  );
  return response.data;
}

export function applyToOffer(
  session: AccessTokenSource,
  offerId: string,
  message: string,
): Promise<CandidateApplicationApi> {
  const trimmed = message.trim();
  return authorizedRequest<CandidateApplicationApi>(session, CANDIDATE_BASE, {
    method: "POST",
    body: trimmed ? { offerId, message: trimmed } : { offerId },
  });
}

export async function fetchReceivedApplications(
  session: AccessTokenSource,
  signal?: AbortSignal,
): Promise<ReceivedApplicationApi[]> {
  const response = await authorizedRequest<ListResponse<ReceivedApplicationApi>>(
    session,
    COMPANY_BASE,
    { signal },
  );
  return response.data;
}

export function changeApplicationStatus(
  session: AccessTokenSource,
  applicationId: string,
  status: ApplicationStatusTarget,
): Promise<ReceivedApplicationApi> {
  return authorizedRequest<ReceivedApplicationApi>(
    session,
    `${COMPANY_BASE}/${encodeURIComponent(applicationId)}/status`,
    { method: "PATCH", body: { status } },
  );
}

/** CV joint à une candidature reçue (PDF), pour l'entreprise. */
export function downloadApplicationCv(
  session: AccessTokenSource,
  applicationId: string,
): Promise<Blob> {
  return authorizedRequest<Blob>(
    session,
    `${COMPANY_BASE}/${encodeURIComponent(applicationId)}/cv`,
    { responseType: "blob" },
  );
}
