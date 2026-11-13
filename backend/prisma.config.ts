// Configuration de la ligne de commande Prisma (generate, migrate, studio…).
// Depuis Prisma 7, l'adresse de la base est déclarée ici et non dans schema.prisma,
// et le fichier .env doit être chargé explicitement.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
