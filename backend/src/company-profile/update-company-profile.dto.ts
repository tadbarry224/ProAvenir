import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { collapseSpaces } from '../company-offers/offer-rules.js';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateCompanyProfileDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? collapseSpaces(value) : value,
  )
  @IsString({ message: 'Renseignez le nom de l’entreprise.' })
  @Length(2, 120, {
    message: 'Le nom doit contenir entre 2 et 120 caractères.',
  })
  name?: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString({ message: 'Le secteur doit être un texte.' })
  @MaxLength(120, { message: 'Le secteur est limité à 120 caractères.' })
  sector?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Choisissez une ville dans la liste.',
  })
  @MaxLength(50, { message: 'Choisissez une ville dans la liste.' })
  cityId?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsString({ message: 'La description doit être un texte.' })
  @MaxLength(2000, {
    message: 'La description est limitée à 2 000 caractères.',
  })
  description?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @IsEmail({}, { message: 'Indiquez une adresse e-mail de contact valide.' })
  @MaxLength(254, { message: 'L’adresse e-mail est limitée à 254 caractères.' })
  contactEmail?: string | null;

  @Transform(trimOptional)
  @IsOptional()
  @Matches(/^\+?[\d(). -]*\d[\d(). -]*$/, {
    message: 'Indiquez un numéro de téléphone valide.',
  })
  @MaxLength(32, { message: 'Le téléphone est limité à 32 caractères.' })
  phone?: string | null;
}
