/**
 * Pages de l'application et leurs adresses (URL).
 *
 * La navigation passe par React Router : chaque page a une vraie adresse, donc
 * F5 garde la page affichée, le bouton « Retour » du navigateur fonctionne et
 * le lien d'une offre (/offres/<id>) peut être partagé.
 * Ce fichier ne dépend pas de React : toutes les couches peuvent l'importer.
 */
export type Page =
  | "home"
  | "jobs"
  | "job"
  | "login"
  | "register"
  | "candidate"
  | "company"
  | "admin"
  /** Pas une page : demande de déconnexion (révoque la session, puis accueil). */
  | "logout";

/** Adresse de chaque page (sauf « job », qui dépend de l'offre : `jobPath`). */
export const PAGE_PATHS = {
  home: "/",
  jobs: "/offres",
  login: "/connexion",
  register: "/inscription",
  candidate: "/espace-candidat",
  company: "/espace-entreprise",
  admin: "/administration",
} as const satisfies Partial<Record<Page, string>>;

/** Adresse du détail d'une offre : « /offres/3000…0001 ». */
export const jobPath = (id: string) => `${PAGE_PATHS.jobs}/${encodeURIComponent(id)}`;

/**
 * Page correspondant à une adresse, ou `null` si l'adresse est inconnue.
 * Une barre finale est tolérée (« /offres/ » = « /offres »).
 */
export function pageFromPath(pathname: string): Page | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const page = (Object.keys(PAGE_PATHS) as (keyof typeof PAGE_PATHS)[]).find(
    (key) => PAGE_PATHS[key] === path,
  );
  if (page) return page;
  if (/^\/offres\/[^/]+$/.test(path)) return "job";
  return null;
}
