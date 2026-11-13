/**
 * Pages de l'application.
 *
 * La navigation repose pour l'instant sur un simple état React (`page` dans App).
 * Ce type est dans son propre fichier pour que toutes les pages puissent l'importer
 * sans dépendre de App.tsx (ce qui créerait un import circulaire).
 */
export type Page =
  | "home"
  | "jobs"
  | "job"
  | "login"
  | "register"
  | "candidate"
  | "company"
  | "admin";
