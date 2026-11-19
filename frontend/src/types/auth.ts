/**
 * Rôles des comptes (mêmes valeurs que l'énumération Prisma `UserRole` du backend).
 */
import type { Page } from "./navigation";

export const USER_ROLES = ["CANDIDATE", "COMPANY", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Identité de la personne connectée, affichée dans son espace. */
export type DashboardIdentity = {
  name: string; // « Mariama Diallo », ou le nom de l'entreprise
  initials: string; // « MD »
  firstName: string; // pour « Bonjour, Mariama »
  statusLabel: string; // « Compte vérifié », « En attente de validation »…
};

/** Espace réservé à chaque rôle. */
export const ROLE_HOME = {
  CANDIDATE: "candidate",
  COMPANY: "company",
  ADMIN: "admin",
} as const satisfies Record<UserRole, Page>;

/** Rôle exigé pour chaque espace protégé (les autres pages sont publiques). */
export const PROTECTED_PAGES: Partial<Record<Page, UserRole>> = {
  candidate: "CANDIDATE",
  company: "COMPANY",
  admin: "ADMIN",
};
