import { validateEnv } from './env.validation.js';

const valid = {
  NODE_ENV: 'development',
  PORT: '3001',
  DATABASE_URL:
    'postgresql://user:secret@127.0.0.1:5434/proavenir?schema=public',
  CORS_ORIGIN: 'http://localhost:8443, http://localhost:5173',
};

describe('validateEnv', () => {
  it('accepte une configuration complète et convertit les types', () => {
    expect(validateEnv(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      DATABASE_URL: valid.DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:8443', 'http://localhost:5173'],
    });
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
