/**
 * Définit le mot de passe d'un compte existant (comptes de démonstration, administrateur).
 *
 *   npm run db:set-password -- mariama.diallo@proavenir.test
 *
 * Le mot de passe est demandé au clavier, SANS être affiché, puis haché avec
 * argon2id (mêmes réglages que l'API). Il n'est jamais écrit dans un fichier.
 * Les sessions ouvertes du compte sont révoquées.
 *
 * Sans terminal interactif (ex. script), le mot de passe est lu sur l'entrée
 * standard : echo "…" | npm run db:set-password -- e-mail
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../src/auth/password.js';

/** Lit une ligne au clavier en masquant la saisie (affiche « * »). */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('Annulé.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function readPiped(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += String(chunk);
  return data.split(/\r?\n/)[0] ?? '';
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Usage : npm run db:set-password -- adresse@exemple.test');
  }

  let password: string;
  if (process.stdin.isTTY) {
    password = await askHidden(`Nouveau mot de passe pour ${email} : `);
    const confirmation = await askHidden('Confirmer le mot de passe : ');
    if (password !== confirmation) {
      throw new Error(
        'Les deux saisies sont différentes. Rien n’a été modifié.',
      );
    }
  } else {
    password = await readPiped();
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Le mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères. Rien n’a été modifié.`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) throw new Error(`Aucun compte avec l’adresse ${email}.`);

    const passwordHash = await hashPassword(password);
    const [, revoked] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    console.log(
      `Mot de passe défini pour ${email} (rôle ${user.role}). Sessions révoquées : ${revoked.count}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
