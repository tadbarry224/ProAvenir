/**
 * Identité affichée dans les espaces (barre latérale, en-tête, « Bonjour, … »),
 * construite à partir de la SESSION : c'est toujours la personne réellement connectée.
 */
import type { SessionUser } from "../../services/authService";
import type { DashboardIdentity } from "../../types/auth";
import { DEMO_ACCOUNTS } from "./demoAccounts";

const COMPANY_STATUS_LABELS = {
  APPROVED: "Compte vérifié",
  PENDING: "En attente de validation",
  REJECTED: "Compte refusé",
} as const;

/** « Mariama Diallo » → « MD » ; « Administrateur » → « AD ». */
export function initialsOfName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function identityOf(user: SessionUser): DashboardIdentity {
  const firstName = user.fullName.trim().split(/\s+/)[0] ?? user.fullName;
  if (user.role === "COMPANY" && user.company) {
    return {
      name: user.company.name,
      initials: initialsOfName(user.company.name),
      firstName,
      statusLabel: COMPANY_STATUS_LABELS[user.company.status],
    };
  }
  return {
    name: user.fullName,
    initials: initialsOfName(user.fullName),
    firstName,
    statusLabel: user.role === "ADMIN" ? "Accès sécurisé" : "Compte vérifié",
  };
}

/**
 * Le contenu des espaces (candidatures, offres de l'entreprise) est encore
 * FICTIF jusqu'aux étapes B4–B5 et appartient aux comptes de démonstration.
 * Il n'est donc montré qu'à ces comptes, et seulement en développement ;
 * un nouveau compte (ou tout compte en production) voit un espace vide.
 */
export function ownsDemoData(user: SessionUser | null): boolean {
  return (
    import.meta.env.DEV &&
    DEMO_ACCOUNTS.some((account) => account.email === user?.email && account.role === user.role)
  );
}
