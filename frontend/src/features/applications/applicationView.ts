/**
 * Conversion des candidatures de l'API pour l'affichage, et messages d'erreur.
 * Fonctions pures (sans React).
 */
import { formatShortDate } from "../../lib/dates";
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import {
  APPLICATION_ERROR_CODES,
  type CandidateApplicationApi,
  type ReceivedApplicationApi,
} from "../../services/applicationsService";
import { initialsOfName } from "../auth/identity";
import {
  APPLICATION_STATUS_LABELS,
  type CandidateApplicationView,
  type RecruitApplicationView,
} from "../../types/application";

export function toCandidateApplicationView(
  application: CandidateApplicationApi,
): CandidateApplicationView {
  return {
    id: application.id,
    offerId: application.offer.id,
    title: application.offer.title,
    company: application.offer.company.name,
    date: formatShortDate(application.createdAt),
    status: application.status,
    statusLabel: APPLICATION_STATUS_LABELS[application.status],
    offerOnline: application.offer.publiclyVisible,
  };
}

export function toRecruitApplicationView(
  application: ReceivedApplicationApi,
): RecruitApplicationView {
  return {
    id: application.id,
    name: application.candidate.fullName,
    initials: initialsOfName(application.candidate.fullName),
    email: application.candidate.email,
    role: application.offer.title,
    date: formatShortDate(application.createdAt),
    status: application.status,
    statusLabel: APPLICATION_STATUS_LABELS[application.status],
    message: application.message,
    cvFileName: application.cvFileName,
  };
}

export type ApplicationActionError = {
  /** "session" : se reconnecter ; "stale" : l'écran était périmé (liste relue). */
  kind: "session" | "stale" | "other";
  message: string;
};

/** Erreur d'une requête de candidature → message clair en français. */
export function applicationErrorFromApi(error: unknown): ApplicationActionError {
  if (!(error instanceof ApiError)) {
    return { kind: "other", message: "Une erreur inattendue est survenue." };
  }
  if (error.status === 401) return { kind: "session", message: SESSION_EXPIRED_MESSAGE };
  switch (error.code) {
    case APPLICATION_ERROR_CODES.alreadyApplied:
    case APPLICATION_ERROR_CODES.invalidTransition:
    case APPLICATION_ERROR_CODES.applicationNotFound:
      return { kind: "stale", message: error.message };
    default:
      return { kind: "other", message: error.message };
  }
}
