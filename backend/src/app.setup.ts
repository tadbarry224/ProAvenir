import { ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { validationException } from './common/api-error.js';
import type { EnvironmentVariables } from './config/env.validation.js';

/**
 * Options du ValidationPipe global (exportées pour que les tests unitaires des
 * DTO valident exactement comme l'application) :
 * - whitelist : ignore les champs non déclarés ; forbidNonWhitelisted : les refuse (400) ;
 * - transform : applique les @Transform (ex. suppression des espaces) ;
 * - exceptionFactory : erreur 400 au format commun (code VALIDATION_FAILED + details).
 */
export const validationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationException,
};

/**
 * Réglages communs de l'application HTTP.
 * Utilisés par main.ts ET par les tests de bout en bout, pour que les tests
 * vérifient exactement la même configuration que l'application réelle.
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Toutes les routes commencent par /api (ex. GET /api/health).
  app.setGlobalPrefix('api');

  // Validation automatique des paramètres reçus (query, body) d'après les DTO.
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

  // Lit les cookies reçus (cookie de rafraîchissement de session).
  app.use(cookieParser());

  // Seules les adresses du frontend listées dans CORS_ORIGIN peuvent appeler l'API
  // depuis un navigateur. `credentials` prépare l'envoi du cookie de rafraîchissement (B3).
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  // Ferme proprement la connexion à la base quand le serveur s'arrête (Ctrl+C).
  app.enableShutdownHooks();
}
