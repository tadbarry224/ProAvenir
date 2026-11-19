/**
 * Données de départ de ProAvenir.
 * Lancement : npx prisma db seed   (après `npx prisma migrate deploy`)
 *
 * - Idempotent : chaque ligne est créée ou mise à jour selon son identifiant fixe
 *   (upsert). Relancer le script ne crée aucun doublon.
 * - Non destructif : aucune suppression ; les données ajoutées par ailleurs sont conservées.
 * - Transactionnel : en cas d'erreur, rien n'est enregistré à moitié.
 * - Aucun mot de passe : les comptes de démonstration ne peuvent pas se connecter
 *   (passwordHash = null) ; voir README.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  applications,
  candidateProfiles,
  cities,
  companies,
  companyOwners,
  domains,
  offers,
  users,
} from './seed-data.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL manquant (backend/.env).');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const city of cities) {
      await tx.city.upsert({
        where: { id: city.id },
        create: city,
        update: { name: city.name },
      });
    }
    for (const domain of domains) {
      await tx.domain.upsert({
        where: { id: domain.id },
        create: domain,
        update: { name: domain.name },
      });
    }

    for (const { id, ...data } of [
      ...users,
      ...companyOwners.map((owner) => owner.user),
    ]) {
      await tx.user.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    }

    for (const { id, createdAt, reviewedAt, ...data } of companies) {
      const fields = {
        ...data,
        reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
        // Relancer le seed remet aussi le motif de refus à zéro (entreprises de
        // démonstration revenues « en attente » après un essai de refus).
        rejectionReason: null,
      };
      await tx.company.upsert({
        where: { id },
        create: { id, ...fields, createdAt: new Date(createdAt) },
        update: fields,
      });
    }
    for (const { member } of companyOwners) {
      const { id, ...data } = member;
      await tx.companyMember.upsert({
        where: { id },
        create: member,
        update: data,
      });
    }

    for (const { id, ...data } of candidateProfiles) {
      await tx.candidateProfile.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    }

    for (const { id, publishedAt, deadline, ...data } of offers) {
      const fields = {
        ...data,
        status: 'PUBLISHED' as const,
        publishedAt: new Date(publishedAt),
        deadline: new Date(deadline), // colonne DATE : seul le jour est conservé
      };
      await tx.offer.upsert({
        where: { id },
        create: { id, ...fields, createdAt: new Date(publishedAt) },
        update: fields,
      });
    }

    for (const { id, createdAt, ...data } of applications) {
      await tx.application.upsert({
        where: { id },
        create: { id, ...data, createdAt: new Date(createdAt) },
        update: data,
      });
    }
  });

  const counts = {
    City: await prisma.city.count(),
    Domain: await prisma.domain.count(),
    User: await prisma.user.count(),
    Company: await prisma.company.count(),
    CompanyMember: await prisma.companyMember.count(),
    CandidateProfile: await prisma.candidateProfile.count(),
    Offer: await prisma.offer.count(),
    Application: await prisma.application.count(),
    RefreshToken: await prisma.refreshToken.count(),
  };
  console.log('Données de départ appliquées. Lignes par table :');
  console.table(counts);
}

main()
  .catch((error: unknown) => {
    console.error('Échec des données de départ :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
