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
  };
}
