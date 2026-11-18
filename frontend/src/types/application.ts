/**
 * Candidatures (données de démonstration).
 *
 * Pour l'instant, deux formes coexistent, chacune liée à un écran :
 * - côté entreprise : qui a postulé à quelle offre (RecruitApplication) ;
 * - côté candidat : mes candidatures (CandidateApplication).
 * Elles seront unifiées en un seul modèle `Application` lors de l'étape « candidatures »,
 * avec des identifiants (candidat, offre) au lieu de noms et de titres.
 */

/** Candidature vue par l'entreprise. */
export type RecruitApplication = {
  name: string;
  role: string;
  date: string;
  status: string;
  initials: string;
};

/** Candidature vue par le candidat. */
export type CandidateApplication = {
  title: string;
  company: string;
  date: string;
  status: string;
};
