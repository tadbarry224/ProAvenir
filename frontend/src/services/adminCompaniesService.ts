/**
 * Vérification des entreprises par l'administration (rôle ADMIN), routes protégées :
 *   GET   /api/admin/companies              → toutes les entreprises, en attente d'abord
 *   PATCH /api/admin/companies/:id/status   → approuver ou refuser (motif obligatoire)
 *
 * Chaque fonction reçoit la session (`useAuth()` convient tel quel) : le jeton est lu
 * en mémoire et renouvelé automatiquement s'il a expiré (authorizedRequest).
 */
import { authorizedRequest, type AccessTokenSource } from "./apiClient";
import type { CompanyStatus } from "./companyOffersService";
import type { ReferenceItem } from "./referenceService";

/** Entreprise telle que renvoyée à l'administration (mêmes champs que le backend). */
export type AdminCompanyApi = {
  id: string;
  name: string;
  sector: string | null;
  city: ReferenceItem | null;
  status: CompanyStatus;
  /** Motif montré à l'entreprise ; null sauf si elle est refusée. */
  rejectionReason: string | null;
  /** Dates ISO complètes. */
  createdAt: string;
  reviewedAt: string | null;
  offersCount: number;
};

export type AdminCompaniesResult = {
  companies: AdminCompanyApi[];
  /** Nombre d'entreprises en attente de vérification. */
  pending: number;
};

/** Décision de l'administrateur. */
export type CompanyReview = { status: "APPROVED" } | { status: "REJECTED"; reason: string };

/** Codes d'erreur stables (identiques à backend/src/admin-companies/company-review-rules.ts). */
export const ADMIN_COMPANY_ERROR_CODES = {
  validationFailed: "VALIDATION_FAILED", // 400 (motif manquant ou trop court…)
  invalidCompanyId: "INVALID_COMPANY_ID", // 400
  companyNotFound: "COMPANY_NOT_FOUND", // 404
  alreadyInStatus: "COMPANY_ALREADY_IN_STATUS", // 409
  identityChanged: "COMPANY_IDENTITY_CHANGED", // 409
} as const;

/** Longueur du motif de refus acceptée par le serveur. */
export const REJECTION_REASON = { min: 5, max: 500 } as const;

const BASE = "/admin/companies";

type ListResponse = { data: AdminCompanyApi[]; meta: { total: number; pending: number } };

export async function fetchAdminCompanies(
  session: AccessTokenSource,
  signal?: AbortSignal,
): Promise<AdminCompaniesResult> {
  const response = await authorizedRequest<ListResponse>(session, BASE, { signal });
  return { companies: response.data, pending: response.meta.pending };
}

export function reviewCompany(
  session: AccessTokenSource,
  companyId: string,
  review: CompanyReview,
  expectedName?: string,
): Promise<AdminCompanyApi> {
  return authorizedRequest<AdminCompanyApi>(
    session,
    `${BASE}/${encodeURIComponent(companyId)}/status`,
    { method: "PATCH", body: { ...review, expectedName } },
  );
}
