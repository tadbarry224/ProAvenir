import { resolve } from 'node:path';
import { validateEnv } from './env.validation.js';

const valid = {
  NODE_ENV: 'development',
  PORT: '3001',
  DATABASE_URL:
    'postgresql://user:secret@127.0.0.1:5434/proavenir?schema=public',
  CORS_ORIGIN: 'http://localhost:8443, http://localhost:5173',
  // Valeur de test uniquement (aléatoire, sans signification).
  JWT_ACCESS_SECRET: 'Qv7rK2pX9mLw4ZtB8nHc3JdF6sGy1RuE5aTk0VbN',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: '30',
};

describe('validateEnv', () => {
  it('accepte une configuration complète et convertit les types', () => {
    expect(validateEnv(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      DATABASE_URL: valid.DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:8443', 'http://localhost:5173'],
      JWT_ACCESS_SECRET: valid.JWT_ACCESS_SECRET,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      // Par défaut : storage/cvs, à partir du dossier de lancement (backend/).
      CV_STORAGE_DIR: resolve('storage/cvs'),
    });
  });

  it('accepte un autre dossier pour les CV', () => {
    const config = validateEnv({ ...valid, CV_STORAGE_DIR: 'data/cv' });
    expect(config.CV_STORAGE_DIR).toBe(resolve('data/cv'));
  });

  it('refuse un secret JWT absent, trop court ou laissé à « change-me »', () => {
    for (const JWT_ACCESS_SECRET of [
      undefined,
      'court',
      'change-me'.repeat(5),
    ]) {
      expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET })).toThrow(
        /JWT_ACCESS_SECRET/,
      );
    }
  });

  it('refuse un secret de démonstration en production uniquement', () => {
    const demo = {
      ...valid,
      JWT_ACCESS_SECRET: 'mon-secret-de-demo-pour-proavenir-123',
    };
    expect(() => validateEnv(demo)).not.toThrow();
    expect(() => validateEnv({ ...demo, NODE_ENV: 'production' })).toThrow(
      /interdit en production/,
    );
    expect(() =>
      validateEnv({
        ...valid,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'ab'.repeat(20),
      }),
    ).toThrow(/interdit en production/);
    expect(() =>
      validateEnv({ ...valid, NODE_ENV: 'production' }),
    ).not.toThrow();
  });

  it('valide les durées des jetons', () => {
    expect(
      validateEnv({ ...valid, ACCESS_TOKEN_TTL: '1h' })
        .ACCESS_TOKEN_TTL_SECONDS,
    ).toBe(3600);
    for (const ACCESS_TOKEN_TTL of ['15', '30s', '2h', 'quinze']) {
      expect(() => validateEnv({ ...valid, ACCESS_TOKEN_TTL })).toThrow(
        /ACCESS_TOKEN_TTL/,
      );
    }
    for (const REFRESH_TOKEN_TTL_DAYS of ['0', '91', '1.5']) {
      expect(() => validateEnv({ ...valid, REFRESH_TOKEN_TTL_DAYS })).toThrow(
        /REFRESH_TOKEN_TTL_DAYS/,
      );
    }
  });

  it('applique des valeurs par défaut pour NODE_ENV et PORT', () => {
    const { NODE_ENV, PORT } = validateEnv({
      ...valid,
      NODE_ENV: undefined,
      PORT: undefined,
    });
    expect(NODE_ENV).toBe('development');
    expect(PORT).toBe(3001);
  });

  it('refuse une configuration sans base de données', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: '' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuse un port invalide', () => {
    expect(() => validateEnv({ ...valid, PORT: '99999' })).toThrow(/PORT/);
  });

  it('refuse une origine CORS ouverte à tous (« * »)', () => {
    expect(() => validateEnv({ ...valid, CORS_ORIGIN: '*' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  it('liste toutes les erreurs en une seule fois', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*CORS_ORIGIN/);
  });
});
