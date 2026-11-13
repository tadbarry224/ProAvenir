/**
 * Comptes de démonstration (données de départ du backend), utilisés UNIQUEMENT
 * par les boutons « Accès rapide à la démonstration » en développement.
 * Aucun mot de passe ici : il est défini localement avec
 *   npm --prefix backend run db:set-password -- <e-mail>
 */
export const DEMO_ACCOUNTS = [
  { label: "Candidat", role: "CANDIDATE", email: "mariama.diallo@proavenir.test" },
  { label: "Entreprise", role: "COMPANY", email: "recrutement.kamsar-solutions@proavenir.test" },
  { label: "Admin", role: "ADMIN", email: "admin@proavenir.test" },
] as const;
