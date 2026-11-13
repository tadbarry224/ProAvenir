/**
 * Candidatures fictives (démonstration).
 * Plus tard, elles viendront de la table `Application` via l'API NestJS.
 */
import type { CandidateApplication, RecruitApplication } from "../types/application";

/** « Mes candidatures » de la candidate de démonstration (Mariama Diallo). */
export const candidateApplications: CandidateApplication[] = [
  {
    title: "Assistant·e marketing digital",
    company: "Kamsar Solutions",
    date: "12 déc. 2026",
    status: "En examen",
  },
  {
    title: "Développeur·se web junior",
    company: "Nimba Digital",
    date: "08 déc. 2026",
    status: "Présélectionnée",
  },
  {
    title: "Chargé·e de clientèle",
    company: "Conakry Services",
    date: "01 déc. 2026",
    status: "Envoyée",
  },
];

/** Candidatures reçues par l'entreprise de démonstration (état initial). */
export const initialRecruitApplications: RecruitApplication[] = [
  {
    name: "Mariama Diallo",
    role: "Assistant·e marketing digital",
    date: "12 déc. 2026",
    status: "En examen",
    initials: "MD",
  },
  {
    name: "Abdoulaye Bah",
    role: "Assistant·e marketing digital",
    date: "11 déc. 2026",
    status: "Envoyée",
    initials: "AB",
  },
  {
    name: "Fatoumata Camara",
    role: "Commercial·e terrain",
    date: "09 déc. 2026",
    status: "Présélectionnée",
    initials: "FC",
  },
];
