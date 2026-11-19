/**
 * Profil et CV du candidat connecté (étape B6), routes protégées (rôle CANDIDATE) :
 *   GET    /api/candidates/me/profile   → profil
 *   PATCH  /api/candidates/me/profile   → modifier (champs envoyés seulement)
 *   PUT    /api/candidates/me/cv        → déposer / remplacer le CV (PDF, 5 Mo au plus)
 *   DELETE /api/candidates/me/cv        → retirer le CV du profil
 *   GET    /api/candidates/me/cv        → télécharger son CV
 *
 * Le candidat est déduit de la session : aucun identifiant n'est envoyé.
 */
import { authorizedRequest, type AccessTokenSource } from "./apiClient";
import type { ReferenceItem } from "./referenceService";

export type CandidateProfileApi = {
  fullName: string;
  email: string;
  city: ReferenceItem | null;
  education: string | null;
  bio: string | null;
  skills: string[];
  /** CV déposé (taille en octets, date ISO), ou null. */
  cv: { fileName: string; size: number; uploadedAt: string } | null;
};

/** Champs modifiables ; une chaîne vide efface la valeur. */
export type CandidateProfilePayload = {
  fullName?: string;
  cityId?: string;
  education?: string;
  bio?: string;
  skills?: string[];
};

/** Mêmes limites que le backend (backend/src/candidate-profile/cv-rules.ts). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_LIMITS = {
  fullNameMin: 2,
  fullNameMax: 100,
  educationMax: 200,
  bioMax: 1000,
  skillsMax: 20,
} as const;

/** Codes d'erreur stables du dépôt de CV. */
export const CV_ERROR_CODES = {
  cvRequired: "CV_REQUIRED", // 400
  cvNotPdf: "CV_NOT_PDF", // 400
  cvTooLarge: "CV_TOO_LARGE", // 413
  cvNotFound: "CV_NOT_FOUND", // 404
} as const;

const BASE = "/candidates/me";

export function fetchMyProfile(
  session: AccessTokenSource,
  signal?: AbortSignal,
): Promise<CandidateProfileApi> {
  return authorizedRequest<CandidateProfileApi>(session, `${BASE}/profile`, { signal });
}

export function updateMyProfile(
  session: AccessTokenSource,
  payload: CandidateProfilePayload,
): Promise<CandidateProfileApi> {
  return authorizedRequest<CandidateProfileApi>(session, `${BASE}/profile`, {
    method: "PATCH",
    body: payload,
  });
}

export function uploadMyCv(session: AccessTokenSource, file: File): Promise<CandidateProfileApi> {
  const form = new FormData();
  form.append("cv", file);
  return authorizedRequest<CandidateProfileApi>(session, `${BASE}/cv`, {
    method: "PUT",
    body: form,
  });
}

export function deleteMyCv(session: AccessTokenSource): Promise<CandidateProfileApi> {
  return authorizedRequest<CandidateProfileApi>(session, `${BASE}/cv`, { method: "DELETE" });
}

export function downloadMyCv(session: AccessTokenSource): Promise<Blob> {
  return authorizedRequest<Blob>(session, `${BASE}/cv`, { responseType: "blob" });
}
