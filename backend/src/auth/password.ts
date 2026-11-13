/**
 * Hachage des mots de passe avec argon2id (recommandation OWASP).
 *
 * Fonctions pures (sans NestJS) : utilisées par AuthService ET par la commande
 * `npm run db:set-password`, pour que les deux hachent exactement de la même façon.
 */
import argon2 from 'argon2';

/** Paramètres OWASP pour argon2id : 19 Mio de mémoire, 2 itérations, 1 fil. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** `false` (jamais d'exception) si le hash est invalide ou ne correspond pas. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Hash d'un mot de passe aléatoire, calculé une fois. Quand l'e-mail est inconnu,
 * on vérifie quand même ce hash : la réponse prend le même temps que pour un
 * vrai compte, ce qui empêche de deviner quels e-mails sont inscrits.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}
