/**
 * Tests du modèle de données sur la vraie base PostgreSQL.
 * Prérequis : `docker compose up -d`, `npx prisma migrate deploy`, `npx prisma db seed`.
 *
 * Chaque test qui écrit travaille dans une transaction ANNULÉE à la fin :
 * la base n'est jamais modifiée par les tests.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  ABDOULAYE_PROFILE_ID,
  MARIAMA_ID,
  MARIAMA_PROFILE_ID,
  companyId,
  companyOwnerId,
  companyOwners,
  offerId,
  users,
} from '../prisma/seed-data.js';
// Règle publique réellement utilisée par GET /api/offers.
import { publicOffersWhere } from '../src/offers/public-offer.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

class Rollback extends Error {}

/** Exécute `work` puis annule tout ce qui a été écrit. */
async function inRolledBackTransaction(
  work: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  await expect(
    prisma.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

const draftOffer = (
  overrides: Partial<Prisma.OfferUncheckedCreateInput> = {},
) => ({
  companyId: companyId(1),
  title: 'Brouillon de test',
  type: 'JOB' as const,
  cityId: 'conakry',
  domainId: 'commerce',
  description: '',
  ...overrides,
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Données de départ', () => {
  it('contiennent les référentiels, entreprises, offres et candidatures attendus', async () => {
    expect(await prisma.city.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.domain.count()).toBeGreaterThanOrEqual(6);
    expect(
      await prisma.offer.count({
        where: { id: { in: [1, 2, 3, 4, 5, 6].map(offerId) } },
      }),
    ).toBe(6);
    expect(
      await prisma.company.count({ where: { status: 'PENDING' } }),
    ).toBeGreaterThanOrEqual(3);
  });

  // La base de développement peut contenir des mots de passe légitimes (comptes
  // inscrits, `db:set-password`) : on vérifie que les DONNÉES DE DÉPART n'en écrivent
  // jamais, ni à la création, ni lors d'une nouvelle exécution du seed (qui ne doit
  // pas effacer un mot de passe défini localement).
  it('ne contiennent ni n’écrasent aucun mot de passe', () => {
    for (const user of [...users, ...companyOwners.map((o) => o.user)]) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });
});

describe('Visibilité publique des offres', () => {
  it('les offres publiées et non expirées sont publiques', async () => {
    expect(
      await prisma.offer.count({ where: publicOffersWhere('2026-11-13') }),
    ).toBe(6);
  });

  it("une offre expirée n'est plus publique (le jour de la date limite reste valable)", async () => {
    // Au 11 janv. 2027, seules les offres jusqu'au 15, 18 et 20 janv. restent publiques.
    expect(
      await prisma.offer.count({ where: publicOffersWhere('2027-01-11') }),
    ).toBe(3);
    expect(
      await prisma.offer.count({ where: publicOffersWhere('2027-01-20') }),
    ).toBe(1);
  });

  it('un brouillon et une offre clôturée ne sont jamais publics', async () => {
    await inRolledBackTransaction(async (tx) => {
      const draft = await tx.offer.create({
        data: draftOffer({ deadline: new Date('2027-06-30') }),
      });
      await tx.offer.update({
        where: { id: offerId(2) },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      const visible = await tx.offer.findMany({
        where: publicOffersWhere('2026-11-13'),
        select: { id: true },
      });
      const ids = visible.map((offer) => offer.id);
      expect(ids).not.toContain(draft.id);
      expect(ids).not.toContain(offerId(2));
      expect(ids).toHaveLength(5);
    });
  });
});

describe('Contraintes de cohérence (CHECK)', () => {
  it('refuse une offre publiée sans date limite', async () => {
    await expect(
      prisma.offer.create({
        data: draftOffer({ status: 'PUBLISHED', publishedAt: new Date() }),
      }),
    ).rejects.toThrow(/Offer_published_fields_check/);
  });

  it('accepte un brouillon sans date limite (dans une transaction annulée)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const draft = await tx.offer.create({ data: draftOffer() });
      expect(draft.status).toBe('DRAFT');
      expect(draft.deadline).toBeNull();
    });
  });

  it('refuse un intitulé de moins de 3 caractères', async () => {
    await expect(
      prisma.offer.create({ data: draftOffer({ title: 'Ab' }) }),
    ).rejects.toThrow(/Offer_title_length_check/);
  });

  it('refuse un e-mail contenant des majuscules', async () => {
    await expect(
      prisma.user.create({
        data: {
          email: 'Test@ProAvenir.test',
          fullName: 'Test',
          role: 'CANDIDATE',
        },
      }),
    ).rejects.toThrow(/User_email_lowercase_check/);
  });

  it('refuse une entreprise refusée sans motif', async () => {
    await expect(
      prisma.company.update({
        where: { id: companyId(7) },
        data: { status: 'REJECTED' },
      }),
    ).rejects.toThrow(/Company_rejection_reason_check/);
  });
});

describe('Unicité', () => {
  it('refuse deux comptes avec le même e-mail', async () => {
    await expect(
      prisma.user.create({
        data: {
          email: 'mariama.diallo@proavenir.test',
          fullName: 'Doublon',
          role: 'CANDIDATE',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuse une deuxième candidature à la même offre', async () => {
    await expect(
      prisma.application.create({
        data: { offerId: offerId(1), candidateId: MARIAMA_PROFILE_ID },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it("refuse qu'un utilisateur appartienne à deux entreprises (V1)", async () => {
    await expect(
      prisma.companyMember.create({
        data: { companyId: companyId(2), userId: companyOwnerId(1) },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('Relations et suppressions', () => {
  it('empêche de supprimer une offre qui a reçu des candidatures', async () => {
    await expect(
      prisma.offer.delete({ where: { id: offerId(1) } }),
    ).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('empêche de supprimer une entreprise qui a des offres', async () => {
    await expect(
      prisma.company.delete({ where: { id: companyId(1) } }),
    ).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('supprimer un compte supprime son profil et ses candidatures (transaction annulée)', async () => {
    await inRolledBackTransaction(async (tx) => {
      await tx.user.delete({ where: { id: MARIAMA_ID } });
      expect(
        await tx.candidateProfile.findUnique({
          where: { id: MARIAMA_PROFILE_ID },
        }),
      ).toBeNull();
      expect(
        await tx.application.count({
          where: { candidateId: MARIAMA_PROFILE_ID },
        }),
      ).toBe(0);
      // Les candidatures des autres candidats ne sont pas touchées.
      expect(
        await tx.application.count({
          where: { candidateId: ABDOULAYE_PROFILE_ID },
        }),
      ).toBe(1);
    });
    expect(
      await prisma.application.count({
        where: { candidateId: MARIAMA_PROFILE_ID },
      }),
    ).toBe(3);
  });

  it('contrôle de propriété : un membre ne voit que les offres de son entreprise', async () => {
    const ownOffers = await prisma.offer.findMany({
      where: { company: { members: { some: { userId: companyOwnerId(1) } } } },
      select: { title: true },
    });
    expect(ownOffers.map((offer) => offer.title)).toEqual([
      'Assistant·e marketing digital',
    ]);
  });

  it('une candidature relie un candidat et une offre par leurs identifiants', async () => {
    const application = await prisma.application.findFirstOrThrow({
      where: { offerId: offerId(2), candidateId: MARIAMA_PROFILE_ID },
      include: {
        offer: { select: { title: true } },
        candidate: { include: { user: true } },
      },
    });
    expect(application.status).toBe('SHORTLISTED');
    expect(application.offer.title).toBe('Développeur·se web junior');
    expect(application.candidate.user.fullName).toBe('Mariama Diallo');
  });
});

describe('Détails du contrat des offres', () => {
  it('les données de départ reprennent les libellés du frontend sans valeur inventée', async () => {
    const byId = async (n: number) =>
      prisma.offer.findUniqueOrThrow({
        where: { id: offerId(n) },
        select: { contractType: true, workSchedule: true, duration: true },
      });
    // « CDI · Temps plein »
    expect(await byId(2)).toEqual({
      contractType: 'CDI',
      workSchedule: 'FULL_TIME',
      duration: null,
    });
    // « Stage · 6 mois » : le rythme de travail n'est pas précisé, il reste vide.
    expect(await byId(1)).toEqual({
      contractType: 'INTERNSHIP',
      workSchedule: null,
      duration: '6 mois',
    });
    // « CDD · 12 mois »
    expect(await byId(3)).toEqual({
      contractType: 'CDD',
      workSchedule: null,
      duration: '12 mois',
    });
  });

  it('refuse un CDI pour un stage et une convention de stage pour un emploi', async () => {
    await expect(
      prisma.offer.create({
        data: draftOffer({ type: 'INTERNSHIP', contractType: 'CDI' }),
      }),
    ).rejects.toThrow(/Offer_contract_matches_type_check/);
    await expect(
      prisma.offer.create({
        data: draftOffer({ type: 'JOB', contractType: 'INTERNSHIP' }),
      }),
    ).rejects.toThrow(/Offer_contract_matches_type_check/);
  });

  it('refuse une durée pour un CDI', async () => {
    await expect(
      prisma.offer.create({
        data: draftOffer({ contractType: 'CDI', duration: '6 mois' }),
      }),
    ).rejects.toThrow(/Offer_cdi_without_duration_check/);
  });

  it('accepte « OTHER » pour les deux types et une offre sans détail de contrat', async () => {
    await inRolledBackTransaction(async (tx) => {
      await tx.offer.create({
        data: draftOffer({ type: 'JOB', contractType: 'OTHER' }),
      });
      await tx.offer.create({
        data: draftOffer({
          type: 'INTERNSHIP',
          contractType: 'OTHER',
          workSchedule: 'PART_TIME',
        }),
      });
      const bare = await tx.offer.create({ data: draftOffer() });
      expect(bare).toMatchObject({
        contractType: null,
        workSchedule: null,
        duration: null,
      });
    });
  });
});
