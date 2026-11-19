import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Validate,
  type ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';
import {
  ContractType,
  OfferType,
  WorkSchedule,
} from '../../generated/prisma/enums.js';
import {
  collapseSpaces,
  CREATION_STATUSES,
  isValidIsoDate,
  normalizeSkills,
  OFFER_RULES,
  type CreationStatus,
} from '../offer-rules.js';

/** Identifiant de ville ou de domaine : "conakry", "ressources-humaines". */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const collapse = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? collapseSpaces(value) : value;
/** Texte vide → null (« pas de valeur »), pour les champs facultatifs. */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
};
/** Nettoie la liste si elle ne contient que du texte (sinon la validation la refusera). */
const cleanSkills = ({ value }: { value: unknown }) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? normalizeSkills(value)
    : value;

@ValidatorConstraint({ name: 'isoDate' })
class IsoDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidIsoDate(value);
  }
}

/**
 * Corps de POST /api/companies/me/offers.
 *
 * Tout champ non listé ici est REFUSÉ (400), en particulier `companyId`,
 * `featured`, `publishedAt`, `closedAt` et `id` : l'entreprise propriétaire vient
 * de la session, la mise en avant de l'administration, les dates du serveur.
 *
 * Les règles qui dépendent du statut (description et date limite obligatoires
 * pour publier) et du jour (date passée) sont vérifiées par le service.
 */
export class CreateCompanyOfferDto {
  @IsIn(CREATION_STATUSES, {
    message: 'Le statut doit valoir DRAFT (brouillon) ou PUBLISHED (publier).',
  })
  status: CreationStatus;

  @Transform(collapse)
  @IsString({ message: 'L’intitulé du poste est obligatoire.' })
  @Length(OFFER_RULES.titleMin, OFFER_RULES.titleMax, {
    message: `L’intitulé doit contenir entre ${OFFER_RULES.titleMin} et ${OFFER_RULES.titleMax} caractères.`,
  })
  title: string;

  @IsIn(Object.values(OfferType), {
    message: 'Choisissez un type d’offre valide.',
  })
  type: OfferType;

  @Transform(trim)
  @IsString({ message: 'Choisissez une ville dans la liste.' })
  @Matches(SLUG, { message: 'Choisissez une ville dans la liste.' })
  @MaxLength(50, { message: 'Choisissez une ville dans la liste.' })
  cityId: string;

  @Transform(trim)
  @IsString({ message: 'Choisissez un domaine dans la liste.' })
  @Matches(SLUG, { message: 'Choisissez un domaine dans la liste.' })
  @MaxLength(50, { message: 'Choisissez un domaine dans la liste.' })
  domainId: string;

  /** Facultative pour un brouillon (texte vide par défaut). */
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La description doit être un texte.' })
  @MaxLength(OFFER_RULES.descriptionMax, {
    message: `La description ne doit pas dépasser ${OFFER_RULES.descriptionMax} caractères.`,
  })
  description?: string;

  /** "AAAA-MM-JJ" ; facultative pour un brouillon. */
  @IsOptional()
  @Transform(emptyToNull)
  @Validate(IsoDateConstraint, {
    message: 'La date limite n’est pas valide (format attendu AAAA-MM-JJ).',
  })
  deadline?: string | null;

  @IsOptional()
  @Transform(cleanSkills)
  @IsArray({ message: 'Les compétences doivent être une liste.' })
  @IsString({ each: true, message: 'Chaque compétence doit être un texte.' })
  @ArrayMaxSize(OFFER_RULES.skillsMax, {
    message: `Indiquez au maximum ${OFFER_RULES.skillsMax} compétences.`,
  })
  @MaxLength(OFFER_RULES.skillMaxLength, {
    each: true,
    message: `Chaque compétence doit faire au maximum ${OFFER_RULES.skillMaxLength} caractères.`,
  })
  skills?: string[];

  // --- Détails du contrat : facultatifs (pas encore saisis dans le formulaire) ---

  @IsOptional()
  @IsIn(Object.values(ContractType), {
    message: 'Type de contrat invalide (CDI, CDD, INTERNSHIP ou OTHER).',
  })
  contractType?: ContractType | null;

  @IsOptional()
  @IsIn(Object.values(WorkSchedule), {
    message: 'Rythme invalide (FULL_TIME ou PART_TIME).',
  })
  workSchedule?: WorkSchedule | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString({ message: 'La durée doit être un texte (ex. « 6 mois »).' })
  @MaxLength(OFFER_RULES.durationMax, {
    message: `La durée ne doit pas dépasser ${OFFER_RULES.durationMax} caractères.`,
  })
  duration?: string | null;
}
