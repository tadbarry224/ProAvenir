/**
 * Modèle de données d'une offre (stage ou emploi).
 *
 * Les valeurs techniques (JOB, DRAFT…) sont en anglais et en majuscules :
 * ce sont celles que la base de données (Prisma) et l'API NestJS utiliseront.
 * Les libellés affichés à l'écran restent en français grâce aux objets *_LABELS.
 */

// --- Listes de valeurs autorisées -------------------------------------------
// `as const` fige les tableaux : TypeScript connaît chaque valeur exacte,
// ce qui permet d'en déduire les types ci-dessous.

export const OFFER_TYPES = ["JOB", "INTERNSHIP"] as const;
export type OfferType = (typeof OFFER_TYPES)[number]; // "JOB" | "INTERNSHIP"

export const OFFER_TYPE_LABELS = {
  JOB: "Emploi",
  INTERNSHIP: "Stage",
} as const satisfies Record<OfferType, string>;
export type OfferTypeLabel = (typeof OFFER_TYPE_LABELS)[OfferType]; // "Emploi" | "Stage"

// Détails du contrat (facultatifs), identiques aux énumérations Prisma du backend.
export const CONTRACT_TYPES = ["CDI", "CDD", "INTERNSHIP", "OTHER"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  INTERNSHIP: "Stage",
  OTHER: "Autre contrat",
};

export const WORK_SCHEDULES = ["FULL_TIME", "PART_TIME"] as const;
export type WorkSchedule = (typeof WORK_SCHEDULES)[number];

export const WORK_SCHEDULE_LABELS: Record<WorkSchedule, string> = {
  FULL_TIME: "Temps plein",
  PART_TIME: "Temps partiel",
};

// Listes uniques, utilisées à la fois par le formulaire de publication et par les filtres publics.
export const OFFER_CITIES = ["Conakry", "Kindia", "Labé", "Boké"] as const;
export type OfferCity = (typeof OFFER_CITIES)[number];

export const OFFER_DOMAINS = [
  "Marketing",
  "Informatique",
  "Commerce",
  "Finance",
  "Ressources humaines",
  "Logistique",
] as const;
export type OfferDomain = (typeof OFFER_DOMAINS)[number];

export const OFFER_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Active",
  CLOSED: "Clôturée",
};

/**
 * Statut affiché dans l'espace entreprise. « EXPIRED » n'est pas enregistré :
 * il est calculé (offre PUBLISHED dont la date limite est dépassée).
 */
export type OfferDisplayStatus = OfferStatus | "EXPIRED";

export const OFFER_DISPLAY_STATUS_LABELS: Record<OfferDisplayStatus, string> = {
  ...OFFER_STATUS_LABELS,
  EXPIRED: "Expirée",
};

// --- Entreprise ----------------------------------------------------------------

/** Entreprise qui publie des offres (future table `Company` de la base de données). */
export type Company = {
  id: number;
  name: string;
  initials: string;
  logoColor: string; // suffixe des classes CSS `.logo-blue`, `.logo-green`…
};

// --- Les trois « formes » d'une offre ----------------------------------------

/**
 * 1. Ce que l'utilisateur saisit dans le formulaire, sans transformation.
 *    Les compétences sont encore un texte libre : "Excel, communication".
 */
export type OfferFormValues = {
  title: string;
  type: OfferType;
  city: OfferCity;
  domain: OfferDomain;
  description: string;
  deadline: string; // "AAAA-MM-JJ" (format renvoyé par <input type="date">), ou "" si vide
  skills: string;
};

/**
 * 2. Les données nettoyées après validation : textes sans espaces superflus,
 *    compétences transformées en liste. C'est ce qui sera envoyé à l'API.
 */
export type OfferInput = Omit<OfferFormValues, "skills"> & {
  skills: string[];
};

/**
 * 3. L'offre enregistrée : les données + les informations ajoutées par le système.
 *    Une offre de l'API (GET /api/companies/me/offers) est convertie dans ce même
 *    format par `companyOfferFromApi` (features/offers/companyOfferMapping.ts).
 */
export type Offer = OfferInput & {
  /** Identifiant texte : UUID pour une offre de l'API. */
  id: string;
  status: OfferStatus;
  createdAt: string; // date ISO complète
  publishedAt: string | null; // date de première publication, null pour un brouillon jamais publié
  /** Détails du contrat, tous facultatifs (pas encore saisis dans le formulaire de
   *  publication). Affichés par toJobView : « CDI · Temps plein », « Stage · 6 mois ». */
  contractType?: ContractType | null;
  workSchedule?: WorkSchedule | null;
  duration?: string | null; // « 3 mois », « 12 mois »
  featured?: boolean; // badge « À la une »
  // --- Calculés par l'API (absents des données fictives) ---
  /** Date de clôture (ISO), null si l'offre n'est pas clôturée. */
  closedAt?: string | null;
  /** Nombre RÉEL de candidatures reçues (PostgreSQL). */
  applicationsCount?: number;
  /** Visible en ce moment dans la liste publique (règle appliquée par le serveur). */
  publiclyVisible?: boolean;
};

/**
 * Modèle d'AFFICHAGE utilisé par les composants publics existants
 * (JobCard, JobLogo, JobDetails…). Il est obtenu à partir d'une `Offer`
 * grâce à `toJobView` : les composants n'ont donc pas eu besoin de changer.
 */
export type Job = {
  id: string; // UUID pour une offre de l'API, identifiant fictif converti en texte sinon
  title: string;
  company: string;
  initials: string;
  city: string;
  domain: string;
  type: OfferTypeLabel;
  contract: string;
  posted: string;
  deadline: string;
  description: string;
  skills: string[];
  color: string;
  featured?: boolean;
};

/** Nom d'un champ du formulaire (sert à associer un message d'erreur à un champ). */
export type OfferField = keyof OfferFormValues;
