/**
 * Validation du formulaire de publication d'offre.
 *
 * Deux modes :
 * - "draft"   (brouillon)   : on accepte une offre incomplète, seul le titre est exigé.
 * - "publish" (publication) : tous les champs obligatoires doivent être valides.
 */
import { isValidIsoDate, todayIsoDate } from "../../lib/dates";
import {
  OFFER_CITIES,
  OFFER_DOMAINS,
  OFFER_TYPES,
  type OfferField,
  type OfferFormValues,
  type OfferInput,
} from "../../types/offer";

export type ValidationMode = "draft" | "publish";

/** Un message d'erreur par champ invalide (les champs valides sont absents). */
export type OfferErrors = Partial<Record<OfferField, string>>;

/**
 * Résultat de la validation :
 * - soit `ok: true` avec les données nettoyées,
 * - soit `ok: false` avec les erreurs à afficher.
 * TypeScript oblige à vérifier `ok` avant d'utiliser `data` ou `errors`.
 */
export type ValidationResult = { ok: true; data: OfferInput } | { ok: false; errors: OfferErrors };

// Règles regroupées ici pour pouvoir les ajuster facilement.
export const OFFER_RULES = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 50,
  descriptionMax: 5000,
  skillsMax: 10,
  skillMaxLength: 40,
} as const;

/**
 * Transforme "Excel, communication, excel" en ["Excel", "communication"] :
 * découpe par virgule, enlève les espaces et les vides, supprime les doublons
 * (sans tenir compte des majuscules).
 */
export function parseSkills(raw: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const part of raw.split(",")) {
    const skill = part.trim().replace(/\s+/g, " ");
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }
  return skills;
}

/** Opération inverse : reconstruit le texte du formulaire à partir d'une offre enregistrée. */
export function toOfferFormValues(input: OfferInput): OfferFormValues {
  return { ...input, skills: input.skills.join(", ") };
}

/**
 * Valide les valeurs du formulaire.
 * @param values valeurs brutes saisies
 * @param mode   "draft" ou "publish"
 * @param today  date du jour "AAAA-MM-JJ" (paramètre pour pouvoir tester avec une date fixe)
 */
export function validateOffer(
  values: OfferFormValues,
  mode: ValidationMode,
  today: string = todayIsoDate(),
): ValidationResult {
  const errors: OfferErrors = {};
  const publishing = mode === "publish";

  // 1. Nettoyage : on retire les espaces inutiles avant de vérifier.
  const title = values.title.trim().replace(/\s+/g, " ");
  const description = values.description.trim();
  const deadline = values.deadline.trim();
  const skills = parseSkills(values.skills);

  // 2. Titre : obligatoire dans les deux modes.
  if (!title) {
    errors.title = "L’intitulé du poste est obligatoire.";
  } else if (title.length < OFFER_RULES.titleMin) {
    errors.title = `L’intitulé doit contenir au moins ${OFFER_RULES.titleMin} caractères.`;
  } else if (title.length > OFFER_RULES.titleMax) {
    errors.title = `L’intitulé ne doit pas dépasser ${OFFER_RULES.titleMax} caractères.`;
  }

  // 3. Listes déroulantes : la valeur doit faire partie des choix proposés.
  //    (Dans l'interface c'est toujours le cas, mais la règle protège contre
  //    des données modifiées ou mal construites.)
  if (!(OFFER_TYPES as readonly string[]).includes(values.type)) {
    errors.type = "Choisissez un type d’offre valide.";
  }
  if (!(OFFER_CITIES as readonly string[]).includes(values.city)) {
    errors.city = "Choisissez une ville dans la liste.";
  }
  if (!(OFFER_DOMAINS as readonly string[]).includes(values.domain)) {
    errors.domain = "Choisissez un domaine dans la liste.";
  }

  // 4. Description : obligatoire seulement pour publier, longueur maximale toujours.
  if (description.length > OFFER_RULES.descriptionMax) {
    errors.description = `La description ne doit pas dépasser ${OFFER_RULES.descriptionMax} caractères.`;
  } else if (publishing && !description) {
    errors.description = "La description est obligatoire pour publier.";
  } else if (publishing && description.length < OFFER_RULES.descriptionMin) {
    errors.description = `La description doit contenir au moins ${OFFER_RULES.descriptionMin} caractères (actuellement ${description.length}).`;
  }

  // 5. Date limite : obligatoire et non passée pour publier ;
  //    facultative pour un brouillon, mais si elle est saisie, elle doit être valide.
  if (deadline && !isValidIsoDate(deadline)) {
    errors.deadline = "La date limite n’est pas valide.";
  } else if (publishing && !deadline) {
    errors.deadline = "La date limite est obligatoire pour publier.";
  } else if (publishing && deadline < today) {
    // Les dates "AAAA-MM-JJ" se comparent correctement comme des textes.
    errors.deadline = "La date limite ne peut pas être dans le passé.";
  }

  // 6. Compétences : facultatives, mais limitées en nombre et en longueur.
  if (skills.length > OFFER_RULES.skillsMax) {
    errors.skills = `Indiquez au maximum ${OFFER_RULES.skillsMax} compétences.`;
  } else if (skills.some((skill) => skill.length > OFFER_RULES.skillMaxLength)) {
    errors.skills = `Chaque compétence doit faire au maximum ${OFFER_RULES.skillMaxLength} caractères.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title,
      type: values.type,
      city: values.city,
      domain: values.domain,
      description,
      deadline,
      skills,
    },
  };
}
