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
 *    Plus tard, `id`, `createdAt` et `publishedAt` seront fournis par le backend.
 */
export type Offer = OfferInput & {
  id: number;
  companyId: number; // l'entreprise propriétaire (future relation Offer → Company)
  status: OfferStatus;
  createdAt: string; // date ISO complète
  publishedAt: string | null; // date de première publication, null pour un brouillon jamais publié
  /** Libellé de contrat des offres fictives (« CDI · Temps plein »). Sera remplacé
   *  par de vrais champs « type de contrat » et « durée » lors d'une étape ultérieure. */
  contract?: string;
  featured?: boolean; // badge « À la une »
};

/**
 * Modèle d'AFFICHAGE utilisé par les composants publics existants
 * (JobCard, JobLogo, JobDetails…). Il est obtenu à partir d'une `Offer`
 * grâce à `toJobView` : les composants n'ont donc pas eu besoin de changer.
 */
export type Job = {
  id: number;
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
