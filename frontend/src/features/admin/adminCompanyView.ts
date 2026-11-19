/**
 * Conversion des entreprises de l'API pour l'affichage, et messages d'erreur
 * des décisions de l'administration. Fonctions pures (sans React).
 */
import { formatShortDate } from "../../lib/dates";
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import {
  ADMIN_COMPANY_ERROR_CODES,
  type AdminCompanyApi,
} from "../../services/adminCompaniesService";
import { COMPANY_REVIEW_STATUS_LABELS, type AdminCompanyView } from "../../types/admin";

export function toAdminCompanyView(company: AdminCompanyApi): AdminCompanyView {
  return {
    id: company.id,
    name: company.name,
    sector: company.sector?.trim() || "Secteur non renseigné",
    city: company.city?.name ?? "Ville non renseignée",
    date: formatShortDate(company.createdAt),
    status: company.status,
    statusLabel: COMPANY_REVIEW_STATUS_LABELS[company.status],
    rejectionReason: company.rejectionReason,
  };
}

export type AdminActionError = {
  /** "session" : l'utilisateur doit se reconnecter ; "stale" : la liste a changé. */
  kind: "session" | "stale" | "validation" | "other";
  message: string;
};

/** Erreur d'une requête d'administration → message clair en français. */
export function adminErrorFromApi(error: unknown): AdminActionError {
  if (!(error instanceof ApiError)) {
    return { kind: "other", message: "Une erreur inattendue est survenue." };
  }
  if (error.status === 401) return { kind: "session", message: SESSION_EXPIRED_MESSAGE };
  if (error.status === 403) {
    return { kind: "other", message: "Cette action est réservée aux administrateurs." };
  }
  switch (error.code) {
    case ADMIN_COMPANY_ERROR_CODES.alreadyInStatus:
    case ADMIN_COMPANY_ERROR_CODES.identityChanged:
      // Un autre administrateur (ou un autre onglet) a déjà décidé.
      return { kind: "stale", message: `${error.message} La liste a été mise à jour.` };
    case ADMIN_COMPANY_ERROR_CODES.companyNotFound:
      return {
        kind: "stale",
        message: "Cette entreprise n’existe plus. La liste a été mise à jour.",
      };
    case ADMIN_COMPANY_ERROR_CODES.validationFailed:
      return { kind: "validation", message: error.message };
    default:
      return { kind: "other", message: error.message };
  }
}
