import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password.js';

/** E-mail sans espaces autour et en minuscules (comme en base). */
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Seuls ces rôles peuvent s'inscrire : un administrateur ne s'inscrit jamais. */
export const REGISTRABLE_ROLES = ['CANDIDATE', 'COMPANY'] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

const EMAIL_MESSAGE = 'Adresse e-mail invalide.';

export class RegisterDto {
  @IsIn(REGISTRABLE_ROLES, {
    message: 'Le type de compte doit être Candidat ou Entreprise.',
  })
  role: RegistrableRole;

  @Transform(trim)
  @IsString()
  @Length(2, 100, {
    message: 'Le nom complet doit contenir entre 2 et 100 caractères.',
  })
  fullName: string;

  /** Obligatoire pour un compte Entreprise, ignoré pour un candidat. */
  @ValidateIf((dto: RegisterDto) => dto.role === 'COMPANY')
  @Transform(trim)
  @IsString({ message: 'Le nom de l’entreprise est obligatoire.' })
  @Length(2, 120, {
    message: 'Le nom de l’entreprise doit contenir entre 2 et 120 caractères.',
  })
  companyName?: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @MaxLength(254, { message: EMAIL_MESSAGE })
  email: string;

  // Le mot de passe n'est jamais modifié (pas de suppression des espaces).
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, {
    message: `Le mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères.`,
  })
  password: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @MaxLength(254, { message: EMAIL_MESSAGE })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: 'E-mail ou mot de passe incorrect.',
  })
  password: string;

  /** « Se souvenir de moi » : session de REFRESH_TOKEN_TTL_DAYS au lieu de 24 h. */
  @IsOptional()
  @IsBoolean({ message: 'rememberMe doit valoir true ou false.' })
  rememberMe?: boolean;
}
