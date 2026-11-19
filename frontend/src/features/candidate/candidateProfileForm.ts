/**
 * Formulaire du profil candidat : conversion API ↔ formulaire et contrôles avant
 * envoi. Fonctions pures (sans React). Le serveur refait toutes les vérifications.
 */
import {
  CV_MAX_BYTES,
  PROFILE_LIMITS,
  type CandidateProfileApi,
  type CandidateProfilePayload,
} from "../../services/candidateProfileService";

/** Valeurs saisies (textes bruts, compétences séparées par des virgules). */
export type CandidateProfileForm = {
  fullName: string;
  cityId: string; // "" = aucune ville
  education: string;
  bio: string;
  skills: string;
};

export type ProfileField = keyof CandidateProfileForm;

export function profileFormFromApi(profile: CandidateProfileApi): CandidateProfileForm {
  return {
    fullName: profile.fullName,
    cityId: profile.city?.id ?? "",
    education: profile.education ?? "",
    bio: profile.bio ?? "",
    skills: profile.skills.join(", "),
  };
}

/** « Excel, , excel , Word » → ["Excel", "Word"] (même règle que le serveur). */
export function parseSkills(text: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const raw of text.split(",")) {
    const skill = raw.replace(/\s+/g, " ").trim();
    if (skill && !seen.has(skill.toLowerCase())) {
      seen.add(skill.toLowerCase());
      skills.push(skill);
    }
  }
  return skills;
}

export type ProfileValidation =
  | { ok: true; payload: CandidateProfilePayload }
  | { ok: false; errors: Partial<Record<ProfileField, string>> };

/** Vérifie le formulaire et prépare la requête (mêmes limites que le serveur). */
export function validateProfileForm(form: CandidateProfileForm): ProfileValidation {
  const fullName = form.fullName.replace(/\s+/g, " ").trim();
  const skills = parseSkills(form.skills);
  const errors: Partial<Record<ProfileField, string>> = {};
  if (
    fullName.length < PROFILE_LIMITS.fullNameMin ||
    fullName.length > PROFILE_LIMITS.fullNameMax
  ) {
    errors.fullName = `Le nom complet doit contenir entre ${PROFILE_LIMITS.fullNameMin} et ${PROFILE_LIMITS.fullNameMax} caractères.`;
  }
  if (form.education.trim().length > PROFILE_LIMITS.educationMax) {
    errors.education = `La formation doit faire au maximum ${PROFILE_LIMITS.educationMax} caractères.`;
  }
  if (form.bio.trim().length > PROFILE_LIMITS.bioMax) {
    errors.bio = `La présentation doit faire au maximum ${PROFILE_LIMITS.bioMax} caractères.`;
  }
  if (skills.length > PROFILE_LIMITS.skillsMax) {
    errors.skills = `Indiquez au maximum ${PROFILE_LIMITS.skillsMax} compétences.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      fullName,
      cityId: form.cityId,
      education: form.education.trim(),
      bio: form.bio.trim(),
      skills,
    },
  };
}

/**
 * Contrôle rapide d'un fichier avant l'envoi (évite d'envoyer 20 Mo pour rien).
 * Le serveur vérifie de toute façon le CONTENU (un vrai PDF), pas seulement le nom.
 */
export function cvFileProblem(file: File): string | null {
  const looksPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!looksPdf) return "Le CV doit être un fichier PDF.";
  if (file.size === 0) return "Ce fichier est vide.";
  if (file.size > CV_MAX_BYTES) return "Le CV ne doit pas dépasser 5 Mo.";
  return null;
}

/** 1 234 567 octets → « 1,2 Mo » ; 45 678 → « 45 Ko ». */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}
