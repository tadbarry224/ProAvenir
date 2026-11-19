/**
 * Candidatures (données réelles de l'API, étape B5).
 *
 * Les valeurs techniques (SENT, IN_REVIEW…) sont celles de la base (Prisma) ;
 * les libellés affichés restent en français grâce à APPLICATION_STATUS_LABELS.
 */

export const APPLICATION_STATUSES = [
  "SENT",
  "IN_REVIEW",
  "SHORTLISTED",
  "ACCEPTED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SENT: "Envoyée",
  IN_REVIEW: "En examen",
  SHORTLISTED: "Présélectionnée",
  ACCEPTED: "Retenue",
  REJECTED: "Refusée",
};

/**
 * Étapes suivantes autorisées (mêmes règles que le serveur,
 * backend/src/applications/application-rules.ts). Retenue et refusée sont définitives.
 */
export const NEXT_APPLICATION_STATUSES: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SENT: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
};

/** Candidature vue par le candidat (« Mes candidatures »). */
export type CandidateApplicationView = {
  id: string;
  offerId: string;
  title: string;
  company: string;
  date: string; // date de dépôt : « 12 déc. 2026 »
  status: ApplicationStatus;
  statusLabel: string;
  /** L'offre est encore en ligne (sinon son lien ne s'ouvre plus). */
  offerOnline: boolean;
};

/** Candidature reçue par l'entreprise. */
export type RecruitApplicationView = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string; // intitulé de l'offre
  date: string;
  status: ApplicationStatus;
  statusLabel: string;
  message: string | null;
};
