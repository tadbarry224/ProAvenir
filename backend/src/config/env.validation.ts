/**
 * Validation des variables d'environnement au démarrage.
 *
 * Si une variable est absente ou invalide, l'application refuse de démarrer
 * avec un message clair (plutôt que d'échouer plus tard de façon obscure).
 * Les valeurs sont lues dans backend/.env (voir .env.example).
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  /** Origines autorisées par CORS (liste issue de CORS_ORIGIN, séparée par des virgules). */
  CORS_ORIGINS: string[];
  /** Secret de signature des jetons d'accès (JWT). Ne jamais l'afficher ni le versionner. */
  JWT_ACCESS_SECRET: string;
  /** Durée de vie d'un jeton d'accès, en secondes (issue de ACCESS_TOKEN_TTL, ex. « 15m »). */
  ACCESS_TOKEN_TTL_SECONDS: number;
  /** Durée maximale d'une session « Se souvenir de moi », en jours. */
  REFRESH_TOKEN_TTL_DAYS: number;
}

/** Morceaux de texte qui trahissent un secret d'exemple ou de démonstration. */
const PLACEHOLDER_SECRETS =
  /change-?me|example|exemple|secret|demo|test|password/i;

/** « 90s », « 15m », « 1h » → secondes ; `null` si le format est invalide. */
function parseDuration(value: string): number | null {
  const match = /^(\d+)(s|m|h)$/.exec(value);
  if (!match) return null;
  return (
    Number(match[1]) * { s: 1, m: 60, h: 3600 }[match[2] as 's' | 'm' | 'h']
  );
}

const NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const errors: string[] = [];
  const text = (key: string) =>
    typeof config[key] === 'string' ? config[key].trim() : '';

  const nodeEnv = text('NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(nodeEnv as NodeEnv)) {
    errors.push(
      `NODE_ENV doit valoir ${NODE_ENVS.join(', ')} (reçu : « ${nodeEnv} »).`,
    );
  }

  const port = Number(text('PORT') || '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT doit être un entier entre 1 et 65535.');
  }

  const databaseUrl = text('DATABASE_URL');
  if (!/^postgres(ql)?:\/\/.+/.test(databaseUrl)) {
    errors.push(
      'DATABASE_URL doit être une adresse PostgreSQL (postgresql://…).',
    );
  }

  const corsOrigins = text('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    errors.push('CORS_ORIGIN doit contenir au moins une adresse de frontend.');
  } else if (
    corsOrigins.some(
      (origin) => origin === '*' || !/^https?:\/\/[^/]+$/.test(origin),
    )
  ) {
    errors.push(
      'CORS_ORIGIN doit lister des origines précises (ex. http://localhost:8443), sans « * » ni chemin.',
    );
  }

  const jwtSecret = text('JWT_ACCESS_SECRET');
  if (jwtSecret.length < 32 || /change-?me/i.test(jwtSecret)) {
    errors.push(
      'JWT_ACCESS_SECRET doit être un secret aléatoire d’au moins 32 caractères (voir .env.example pour le générer).',
    );
  } else if (
    nodeEnv === 'production' &&
    (PLACEHOLDER_SECRETS.test(jwtSecret) || new Set(jwtSecret).size < 16)
  ) {
    errors.push(
      'JWT_ACCESS_SECRET ressemble à un secret de démonstration : interdit en production.',
    );
  }

  const accessTtl = parseDuration(text('ACCESS_TOKEN_TTL') || '15m');
  if (accessTtl === null || accessTtl < 60 || accessTtl > 3600) {
    errors.push(
      'ACCESS_TOKEN_TTL doit être une durée entre 1 minute et 1 heure (ex. 15m).',
    );
  }

  const refreshDays = Number(text('REFRESH_TOKEN_TTL_DAYS') || '30');
  if (!Number.isInteger(refreshDays) || refreshDays < 1 || refreshDays > 90) {
    errors.push('REFRESH_TOKEN_TTL_DAYS doit être un entier entre 1 et 90.');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration invalide (backend/.env) :\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    NODE_ENV: nodeEnv as NodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    JWT_ACCESS_SECRET: jwtSecret,
    ACCESS_TOKEN_TTL_SECONDS: accessTtl as number,
    REFRESH_TOKEN_TTL_DAYS: refreshDays,
  };
}
