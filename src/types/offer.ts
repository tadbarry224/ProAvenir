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

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  JOB: "Emploi",
  INTERNSHIP: "Stage",
};

export const OFFER_CITIES = ["Conakry", "Kindia", "Labé"] as const;
export type OfferCity = (typeof OFFER_CITIES)[number];

export const OFFER_DOMAINS = ["Marketing", "Informatique", "Commerce", "Finance"] as const;
export type OfferDomain = (typeof OFFER_DOMAINS)[number];

export const OFFER_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Active",
  CLOSED: "Clôturée",
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
 *    Plus tard, `id` et `createdAt` seront fournis par le backend.
 */
export type Offer = OfferInput & {
  id: number;
  status: OfferStatus;
  createdAt: string; // date ISO complète
};

/** Nom d'un champ du formulaire (sert à associer un message d'erreur à un champ). */
export type OfferField = keyof OfferFormValues;
