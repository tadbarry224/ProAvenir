/**
 * Entreprises fictives (démonstration).
 * Plus tard, ces données viendront de la table `Company` via l'API NestJS.
 */
import type { Company } from "../types/offer";

export const mockCompanies: Company[] = [
  { id: 1, name: "Kamsar Solutions", initials: "KS", logoColor: "blue" },
  { id: 2, name: "Nimba Digital", initials: "ND", logoColor: "green" },
  { id: 3, name: "Conakry Services", initials: "CS", logoColor: "orange" },
  { id: 4, name: "Fouta Conseil", initials: "FC", logoColor: "violet" },
  { id: 5, name: "Sogué Industrie", initials: "SI", logoColor: "teal" },
  { id: 6, name: "Boké Distribution", initials: "BD", logoColor: "navy" },
];

/**
 * Entreprise « connectée » dans l'espace entreprise de démonstration.
 * TEMPORAIRE : sera remplacée par l'entreprise de l'utilisateur authentifié (étape Auth).
 */
export const DEMO_COMPANY_ID = 1;

export function findCompany(id: number): Company | undefined {
  return mockCompanies.find((company) => company.id === id);
}
