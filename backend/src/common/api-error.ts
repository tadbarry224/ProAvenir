/**
 * Format des erreurs « métier » renvoyées par l'API, pour que le frontend puisse
 * réagir à un CODE stable plutôt qu'au texte du message :
 *
 *   {
 *     "statusCode": 409,
 *     "error": "Conflict",
 *     "code": "OFFER_NOT_PUBLISHABLE",          ← stable, à tester côté frontend
 *     "message": ["La date limite est obligatoire pour publier."],  ← à afficher
 *     "details": [{ "field": "deadline", "message": "La date limite…" }]  ← facultatif
 *   }
 *
 * - `message` : texte en français prêt à afficher (une chaîne, ou une liste quand
 *   il y a plusieurs erreurs, exactement comme les erreurs NestJS habituelles) ;
 * - `details` : présent quand les erreurs portent sur des champs précis.
 * C'est la même forme que l'erreur SESSION_ROTATED de l'authentification, et
 * `ApiError` (frontend/src/services/apiClient.ts) lit déjà `code` et `message`.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  type ValidationError,
} from '@nestjs/common';

export interface ErrorDetail {
  /** Nom du champ concerné (ex. "deadline", "skills"). */
  field: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  details?: ErrorDetail[];
}

/** Erreurs de validation des DTO (400) : code commun à toutes les routes. */
export const VALIDATION_FAILED = 'VALIDATION_FAILED';

const EXCEPTIONS = {
  400: { error: 'Bad Request', Exception: BadRequestException },
  403: { error: 'Forbidden', Exception: ForbiddenException },
  404: { error: 'Not Found', Exception: NotFoundException },
  409: { error: 'Conflict', Exception: ConflictException },
  413: { error: 'Payload Too Large', Exception: PayloadTooLargeException },
} as const;

/**
 * Crée l'exception NestJS correspondante (BadRequest, Forbidden, NotFound,
 * Conflict) avec un corps au format ApiErrorBody.
 * Sans `message`, il est construit à partir des détails.
 */
export function apiError(
  statusCode: keyof typeof EXCEPTIONS,
  code: string,
  message: string | null,
  details?: ErrorDetail[],
): HttpException {
  const { error, Exception } = EXCEPTIONS[statusCode];
  const body: ApiErrorBody = {
    statusCode,
    error,
    code,
    message: message ?? (details ?? []).map((detail) => detail.message),
    ...(details?.length ? { details } : {}),
  };
  return new Exception(body);
}

/** Aplatit les erreurs de class-validator (y compris imbriquées : "a.b"). */
function flatten(errors: ValidationError[], parent = ''): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * `exceptionFactory` du ValidationPipe global : même `message` qu'avant (liste
 * des textes, compatibilité totale), plus `code: VALIDATION_FAILED` et `details`
 * pour savoir quel champ est en cause.
 */
export function validationException(errors: ValidationError[]): HttpException {
  return apiError(400, VALIDATION_FAILED, null, flatten(errors));
}
