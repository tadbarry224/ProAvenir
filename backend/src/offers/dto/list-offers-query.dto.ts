import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OfferType } from '../../generated/prisma/enums.js';

/** Identifiant de ville ou de domaine : minuscules, chiffres et tirets ("ressources-humaines"). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Retire les espaces autour d'un texte ; un texte vide équivaut à « pas de filtre ». */
const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * Filtres acceptés par GET /api/offers. Tous facultatifs et combinables :
 *   /api/offers?city=conakry&domain=informatique&type=JOB&q=react
 * Tout autre paramètre est refusé (400), de même qu'une valeur mal formée.
 */
export class ListOffersQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'city doit être un texte' })
  @Matches(SLUG, { message: 'city doit être un identifiant de ville' })
  @MaxLength(50)
  city?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'domain doit être un texte' })
  @Matches(SLUG, { message: 'domain doit être un identifiant de domaine' })
  @MaxLength(50)
  domain?: string;

  @IsOptional()
  @IsIn(Object.values(OfferType), {
    message: `type doit valoir ${Object.values(OfferType).join(' ou ')}`,
  })
  type?: OfferType;

  /** Recherche dans l'intitulé, le nom de l'entreprise et les compétences. */
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'q doit être un texte' })
  @MaxLength(100, { message: 'q ne doit pas dépasser 100 caractères' })
  q?: string;
}
