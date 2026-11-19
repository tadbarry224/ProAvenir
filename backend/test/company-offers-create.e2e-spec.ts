/**
 * Tests de bout en bout de POST /api/companies/me/offers (B4.2), sur la vraie base.
 *
 * Données de TEST uniquement, créées ici puis retirées : identifiants fixes
 * « 94000000-…01xx », e-mails « e2e-b42-…@proavenir.test », entreprises
 * « [e2e-b42] … » et offres créées par ces entreprises. Les données de départ et
 * les comptes réels ne sont ni lus ni modifiés. Jetons signés directement par
 * l'application (aucun mot de passe). Date du jour simulée (ClockService).
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ClockService } from '../src/common/clock.service.js';
import type {
  CompanyOffer,
  CompanyOffersResponse,
} from '../src/company-offers/company-offer.js';
import { NO_COMPANY_MESSAGE } from '../src/company-offers/company-membership.service.js';
import { PERMISSION_MESSAGES } from '../src/company-offers/offer-rules.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import type { PublicOffersResponse } from '../src/offers/public-offer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const id = (n: number) =>
  `94000000-0000-4000-8000-${String(100 + n).padStart(12, '0')}`;
const email = (name: string) => `e2e-b42-${name}@proavenir.test`;
const TODAY = '2026-11-20';
const TAG = '[e2e-b42]';

const COMPANY = {
  A: id(1),
  B: id(2),
  PENDING: id(3),
  REJECTED: id(4),
  /** Entreprise refusée PENDANT une publication (test du verrou). */
  RACE: id(5),
};
const USER = {
  a: id(11),
  b: id(12),
  pending: id(13),
  rejected: id(14),
  orphan: id(15),
  candidate: id(16),
  admin: id(17),
  race: id(18),
};

const DESCRIPTION =
  'Vous rejoindrez une équipe dynamique et participerez aux projets de l’entreprise.';
const draftBody = {
  status: 'DRAFT',
  title: `${TAG} Brouillon`,
  type: 'JOB',
  cityId: 'conakry',
  domainId: 'commerce',
};
const publishBody = {
  ...draftBody,
  status: 'PUBLISHED',
  title: `${TAG} Publiée`,
  description: DESCRIPTION,
  deadline: '2026-12-31',
  skills: ['Excel', 'Communication'],
};

describe('Création d’offres par l’entreprise connectée (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const bearer = (userId: string, role: UserRole = 'COMPANY') =>
    `Bearer ${jwt.sign({ sub: userId, role })}`;
  const createAs = (
    userId: string,
    body: Record<string, unknown>,
    role: UserRole = 'COMPANY',
  ) =>
    http()
      .post('/api/companies/me/offers')
      .set('Authorization', bearer(userId, role))
      .send(body);
  const countOffers = () =>
    prisma.offer.count({
      where: { companyId: { in: Object.values(COMPANY) } },
    });
  const publicTitles = async () => {
    const res = await http().get('/api/offers?q=e2e-b42').expect(200);
    return (res.body as PublicOffersResponse).data.map((o) => o.title);
  };

  /** Supprime UNIQUEMENT les lignes de ce fichier (offres d'abord : relation Restrict). */
  const removeTestRows = async () => {
    const companyIds = Object.values(COMPANY);
    await prisma.offer.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-b42-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        { id: COMPANY.A, name: `${TAG} Entreprise A`, status: 'APPROVED' },
        { id: COMPANY.B, name: `${TAG} Entreprise B`, status: 'APPROVED' },
        { id: COMPANY.RACE, name: `${TAG} Concurrence`, status: 'APPROVED' },
        { id: COMPANY.PENDING, name: `${TAG} En attente`, status: 'PENDING' },
        {
          id: COMPANY.REJECTED,
          name: `${TAG} Refusée`,
          status: 'REJECTED',
          rejectionReason: 'Test automatique',
        },
      ],
    });
    const user = (userId: string, name: string, role: UserRole) => ({
      id: userId,
      email: email(name),
      fullName: `E2E ${name}`,
      role,
    });
    await prisma.user.createMany({
      data: [
        user(USER.a, 'a', 'COMPANY'),
        user(USER.b, 'b', 'COMPANY'),
        user(USER.pending, 'pending', 'COMPANY'),
        user(USER.rejected, 'rejected', 'COMPANY'),
        user(USER.orphan, 'orphan', 'COMPANY'),
        user(USER.candidate, 'candidate', 'CANDIDATE'),
        user(USER.admin, 'admin', 'ADMIN'),
        user(USER.race, 'race', 'COMPANY'),
      ],
    });
    await prisma.companyMember.createMany({
      data: [
        { companyId: COMPANY.A, userId: USER.a },
        { companyId: COMPANY.B, userId: USER.b },
        { companyId: COMPANY.PENDING, userId: USER.pending },
        { companyId: COMPANY.REJECTED, userId: USER.rejected },
        { companyId: COMPANY.RACE, userId: USER.race },
      ],
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClockService)
      .useValue({ today: () => TODAY })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await removeTestRows(); // restes éventuels d'une exécution interrompue
    await seedTestRows();
  });

  afterAll(async () => {
    await removeTestRows();
    await app.close();
  });

  describe('Accès', () => {
    it('refuse une requête sans jeton (401) et ne crée rien', async () => {
      const before = await countOffers();
      await http().post('/api/companies/me/offers').send(draftBody).expect(401);
      expect(await countOffers()).toBe(before);
    });

    it('refuse un candidat et un administrateur (403)', async () => {
      await createAs(USER.candidate, draftBody, 'CANDIDATE').expect(403);
      await createAs(USER.admin, draftBody, 'ADMIN').expect(403);
    });

    it('refuse un compte entreprise sans entreprise (403)', async () => {
      const res = await createAs(USER.orphan, draftBody).expect(403);
      expect(res.body.message).toBe(NO_COMPANY_MESSAGE);
    });
  });

  describe('Entreprise validée (APPROVED)', () => {
    it('crée un brouillon minimal, enregistré pour SON entreprise et jamais public', async () => {
      const res = await createAs(USER.a, {
        ...draftBody,
        title: `  ${TAG}   Brouillon   minimal `,
      }).expect(201);
      const offer = res.body as CompanyOffer;
      expect(offer).toMatchObject({
        title: `${TAG} Brouillon minimal`,
        status: 'DRAFT',
        description: '',
        deadline: null,
        skills: [],
        featured: false,
        publishedAt: null,
        closedAt: null,
        applicationsCount: 0,
        publiclyVisible: false,
        city: { id: 'conakry', name: 'Conakry' },
      });

      // Vérification directe en base : propriétaire = entreprise de la session.
      const saved = await prisma.offer.findUniqueOrThrow({
        where: { id: offer.id },
        select: { companyId: true, status: true },
      });
      expect(saved).toEqual({ companyId: COMPANY.A, status: 'DRAFT' });

      // Persistance : visible dans « Mes offres », absente de la liste publique.
      const mine = await http()
        .get('/api/companies/me/offers')
        .set('Authorization', bearer(USER.a))
        .expect(200);
      expect(
        (mine.body as CompanyOffersResponse).data.map((o) => o.id),
      ).toContain(offer.id);
      expect(await publicTitles()).not.toContain(offer.title);
    });

    it('accepte un brouillon incomplet (description courte, date passée)', async () => {
      await createAs(USER.a, {
        ...draftBody,
        title: `${TAG} Brouillon incomplet`,
        description: 'À compléter',
        deadline: '2026-01-15',
      }).expect(201);
    });

    it('publie directement une offre complète, visible aussitôt dans l’API publique', async () => {
      const before = Date.now();
      const res = await createAs(USER.a, publishBody).expect(201);
      const offer = res.body as CompanyOffer;
      expect(offer).toMatchObject({
        status: 'PUBLISHED',
        deadline: '2026-12-31',
        skills: ['Excel', 'Communication'],
        publiclyVisible: true,
      });
      const publishedAt = Date.parse(offer.publishedAt ?? '');
      expect(publishedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(await publicTitles()).toContain(publishBody.title);
    });

    it('accepte une date limite égale à aujourd’hui (Conakry)', async () => {
      const res = await createAs(USER.a, {
        ...publishBody,
        title: `${TAG} Dernier jour`,
        deadline: TODAY,
      }).expect(201);
      expect(res.body.publiclyVisible).toBe(true);
    });

    it('enregistre les détails facultatifs du contrat', async () => {
      const res = await createAs(USER.a, {
        ...publishBody,
        title: `${TAG} Stage`,
        type: 'INTERNSHIP',
        contractType: 'INTERNSHIP',
        workSchedule: 'PART_TIME',
        duration: ' 6 mois ',
      }).expect(201);
      expect(res.body).toMatchObject({
        contractType: 'INTERNSHIP',
        workSchedule: 'PART_TIME',
        duration: '6 mois',
      });
    });

    it('nettoie les compétences (doublons et vides retirés)', async () => {
      const res = await createAs(USER.a, {
        ...draftBody,
        title: `${TAG} Compétences`,
        skills: ['Excel', ' excel ', '', 'Word'],
      }).expect(201);
      expect(res.body.skills).toEqual(['Excel', 'Word']);
    });
  });

  describe('Données invalides (400, rien n’est créé)', () => {
    const expect400 = async (
      body: Record<string, unknown>,
      expected: string[],
    ) => {
      const before = await countOffers();
      const res = await createAs(USER.a, body).expect(400);
      for (const message of expected) {
        expect(res.body.message).toContain(message);
      }
      expect(await countOffers()).toBe(before);
    };

    it('publication incomplète : tous les messages renvoyés ensemble', async () => {
      await expect400(
        { ...draftBody, status: 'PUBLISHED', description: 'Trop court' },
        [
          'La description doit contenir au moins 50 caractères pour publier (actuellement 10).',
          'La date limite est obligatoire pour publier.',
        ],
      );
    });

    it('format commun : code VALIDATION_FAILED et champ de chaque erreur (DTO et règles)', async () => {
      // Erreur du DTO (format) et erreurs des règles métier : même code, même forme.
      const dtoError = await createAs(USER.a, {
        ...draftBody,
        title: 'ab',
        featured: true,
      }).expect(400);
      expect(dtoError.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_FAILED',
      });
      expect(
        dtoError.body.details.map((d: { field: string }) => d.field).sort(),
      ).toEqual(['featured', 'title']);

      const rulesError = await createAs(USER.a, {
        ...publishBody,
        cityId: 'atlantis',
        deadline: '2026-11-19',
      }).expect(400);
      expect(rulesError.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [
          { field: 'cityId', message: 'Choisissez une ville dans la liste.' },
          {
            field: 'deadline',
            message: 'La date limite ne peut pas être dans le passé.',
          },
        ],
      });
    });

    it('publication avec une date limite passée', async () => {
      await expect400({ ...publishBody, deadline: '2026-11-19' }, [
        'La date limite ne peut pas être dans le passé.',
      ]);
    });

    it('date inexistante ou mal formée', async () => {
      await expect400({ ...draftBody, deadline: '2026-02-30' }, [
        'La date limite n’est pas valide (format attendu AAAA-MM-JJ).',
      ]);
    });

    it('ville ou domaine inconnus (bien formés)', async () => {
      await expect400({ ...draftBody, cityId: 'atlantis', domainId: 'magie' }, [
        'Choisissez une ville dans la liste.',
        'Choisissez un domaine dans la liste.',
      ]);
    });

    it('intitulé trop court, type inconnu, trop de compétences', async () => {
      await expect400(
        {
          ...draftBody,
          title: ' ab ',
          type: 'FREELANCE',
          skills: Array.from({ length: 11 }, (_, i) => `Compétence ${i}`),
        },
        [
          'L’intitulé doit contenir entre 3 et 120 caractères.',
          'Choisissez un type d’offre valide.',
          'Indiquez au maximum 10 compétences.',
        ],
      );
    });

    it('contrat incohérent avec le type, ou CDI avec une durée', async () => {
      await expect400(
        { ...draftBody, type: 'INTERNSHIP', contractType: 'CDI' },
        [
          'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
        ],
      );
      await expect400({ ...draftBody, contractType: 'CDI', duration: '1 an' }, [
        'Un CDI n’a pas de durée : laissez la durée vide.',
      ]);
    });

    it.each([
      ['companyId', COMPANY.B],
      ['featured', true],
      ['publishedAt', '2026-01-01T00:00:00Z'],
      ['id', id(99)],
    ])('refuse le champ réservé « %s »', async (field, value) => {
      await expect400({ ...draftBody, [field]: value }, [
        `property ${field} should not exist`,
      ]);
    });

    it('n’accepte pas un statut CLOSED à la création', async () => {
      await expect400({ ...draftBody, status: 'CLOSED' }, [
        'Le statut doit valoir DRAFT (brouillon) ou PUBLISHED (publier).',
      ]);
    });
  });

  describe('Statut de l’entreprise', () => {
    it('en attente (PENDING) : brouillon accepté, jamais public', async () => {
      const res = await createAs(USER.pending, {
        ...draftBody,
        title: `${TAG} Brouillon en attente`,
      }).expect(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.publiclyVisible).toBe(false);
    });

    it('en attente (PENDING) : publication refusée (403), rien n’est créé', async () => {
      const before = await countOffers();
      const res = await createAs(USER.pending, {
        ...publishBody,
        title: `${TAG} Publication en attente`,
      }).expect(403);
      expect(res.body.message).toBe(PERMISSION_MESSAGES.pendingPublish);
      expect(res.body.code).toBe('COMPANY_NOT_APPROVED');
      expect(await countOffers()).toBe(before);
      expect(await publicTitles()).not.toContain(
        `${TAG} Publication en attente`,
      );
    });

    it.each([
      ['un brouillon', draftBody],
      ['une publication', publishBody],
    ])('refusée (REJECTED) : %s est refusé (403)', async (_label, body) => {
      const before = await countOffers();
      const res = await createAs(USER.rejected, body).expect(403);
      expect(res.body.message).toBe(PERMISSION_MESSAGES.rejected);
      expect(res.body.code).toBe('COMPANY_REJECTED');
      expect(await countOffers()).toBe(before);
    });

    it('le contrôle de statut passe avant la validation des données', async () => {
      // Une entreprise refusée reçoit 403 même avec des données incomplètes :
      // elle n'apprend rien sur les règles de publication.
      await createAs(USER.rejected, {
        ...draftBody,
        cityId: 'atlantis',
      }).expect(403);
    });
  });

  describe('Cloisonnement', () => {
    it('les offres créées par A n’apparaissent jamais chez B', async () => {
      const res = await http()
        .get('/api/companies/me/offers')
        .set('Authorization', bearer(USER.b))
        .expect(200);
      expect((res.body as CompanyOffersResponse).meta.total).toBe(0);
    });

    it('une publication attend la fin d’un changement de statut en cours, puis le respecte', async () => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      let settled = false;

      // Une transaction « administration » refuse l'entreprise sans valider tout de suite.
      const publication = await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: COMPANY.RACE },
          data: { status: 'REJECTED', rejectionReason: 'Test automatique' },
        });
        // Pendant ce temps, l'entreprise tente de publier.
        const pending = createAs(USER.race, {
          ...publishBody,
          title: `${TAG} Pendant le refus`,
        }).then((res) => {
          settled = true;
          return res;
        });
        await sleep(500);
        // La création est bloquée par le verrou (FOR SHARE) : pas encore de réponse.
        expect(settled).toBe(false);
        return { pending };
      });

      // Refus validé : la création reprend, lit le NOUVEAU statut et refuse.
      const res = await publication.pending;
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(PERMISSION_MESSAGES.rejected);
      expect(
        await prisma.offer.count({ where: { companyId: COMPANY.RACE } }),
      ).toBe(0);
    });

    it('deux créations simultanées donnent deux offres distinctes, sans erreur', async () => {
      const [first, second] = await Promise.all([
        createAs(USER.b, { ...draftBody, title: `${TAG} Simultanée 1` }),
        createAs(USER.b, { ...draftBody, title: `${TAG} Simultanée 2` }),
      ]);
      expect([first.status, second.status]).toEqual([201, 201]);
      expect(first.body.id).not.toBe(second.body.id);
      expect(
        await prisma.offer.count({ where: { companyId: COMPANY.B } }),
      ).toBe(2);
    });
  });
});
