import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  collapseSpaces,
  normalizeSkills,
} from '../../company-offers/offer-rules.js';
import { PROFILE_RULES } from '../cv-rules.js';

/** Identifiant de ville : "conakry", "labe". */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const collapse = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? collapseSpaces(value) : value;
/** Texte vide → null (« non renseigné »). */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
};
/** Comme pour les offres : espaces retirés, doublons supprimés (« Excel », « excel »). */
const cleanSkills = ({ value }: { value: unknown }) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? normalizeSkills(value)
    : value;

/**
 * Corps de PATCH /api/candidates/me/profile. Chaque champ est facultatif : seuls
 * les champs envoyés sont modifiés. Un texte vide efface la valeur (null).
 * Le CV passe par sa propre route (PUT /api/candidates/me/cv). Tout autre champ
 * (e-mail, rôle, CV…) est refusé (400).
 */
export class UpdateCandidateProfileDto {
  @IsOptional()
  @Transform(collapse)
  @IsString({ message: 'Le nom complet est obligatoire.' })
  @Length(PROFILE_RULES.fullNameMin, PROFILE_RULES.fullNameMax, {
    message: `Le nom complet doit contenir entre ${PROFILE_RULES.fullNameMin} et ${PROFILE_RULES.fullNameMax} caractères.`,
  })
  fullName?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_dto, value) => value !== null)
  @IsString({ message: 'Choisissez une ville dans la liste.' })
  @Matches(SLUG, { message: 'Choisissez une ville dans la liste.' })
  @MaxLength(50, { message: 'Choisissez une ville dans la liste.' })
  cityId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_dto, value) => value !== null)
  @IsString({ message: 'La formation doit être un texte.' })
  @MaxLength(PROFILE_RULES.educationMax, {
    message: `La formation doit faire au maximum ${PROFILE_RULES.educationMax} caractères.`,
  })
  education?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_dto, value) => value !== null)
  @IsString({ message: 'La présentation doit être un texte.' })
  @MaxLength(PROFILE_RULES.bioMax, {
    message: `La présentation doit faire au maximum ${PROFILE_RULES.bioMax} caractères.`,
  })
  bio?: string | null;

  @IsOptional()
  @Transform(cleanSkills)
  @IsArray({ message: 'Les compétences doivent être une liste.' })
  @IsString({ each: true, message: 'Chaque compétence doit être un texte.' })
  @ArrayMaxSize(PROFILE_RULES.skillsMax, {
    message: `Indiquez au maximum ${PROFILE_RULES.skillsMax} compétences.`,
  })
  @MaxLength(PROFILE_RULES.skillMaxLength, {
    each: true,
    message: `Chaque compétence doit faire au maximum ${PROFILE_RULES.skillMaxLength} caractères.`,
  })
  skills?: string[];
}
