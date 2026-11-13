/**
 * Jeton de rafraîchissement : valeur aléatoire, transportée dans un cookie.
 *
 * - Valeur : 32 octets aléatoires (cryptographiquement sûrs).
 * - En base : uniquement son empreinte SHA-256. Une fuite de la base ne permet
 *   donc pas de se connecter.
 * - Cookie `httpOnly` (illisible par JavaScript : protège contre le vol par XSS),
 *   `SameSite=Strict` (jamais envoyé depuis un autre site : protège contre le CSRF),
 *   `Secure` en production (HTTPS uniquement), limité au chemin /api/auth.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'proavenir_refresh';
const COOKIE_PATH = '/api/auth';

/** Durée maximale d'une session sans « Se souvenir de moi ». */
export const SESSION_MAX_HOURS = 24;

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: COOKIE_PATH };
}

/**
 * Pose le cookie. Session persistante : il expire avec la session (au plus
 * REFRESH_TOKEN_TTL_DAYS). Sinon : cookie de session, effacé à la fermeture du
 * navigateur (et refusé par le serveur après SESSION_MAX_HOURS).
 */
export function setRefreshCookie(
  res: Response,
  token: string,
  session: { persistent: boolean; expiresAt: Date },
  secure: boolean,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions(secure),
    ...(session.persistent ? { expires: session.expiresAt } : {}),
  });
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions(secure));
}
