/**
 * Tests de bout en bout de GET /api/companies/me/offers (B4.1), sur la vraie base.
 *
 * Toutes les données utilisées sont des lignes de TEST créées ici puis retirées :
 * identifiants fixes « 94000000-… », e-mails « e2e-b4-…@proavenir.test »,
 * entreprises « [e2e-b4] … ». Les données de départ et les comptes réels ne sont
 * ni lus ni modifiés. Les jetons d'accès sont signés directement par l'application
 * (aucun mot de passe nécessaire). La date du jour est simulée (ClockService).
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ClockService } from '../src/common/clock.service.js';
import type { CompanyOffersResponse } from '../src/company-offers/company-offer.js';
import { NO_COMPANY_MESSAGE } from '../src/company-offers/company-membership.service.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import type { PublicOffersResponse } from '../src/offers/public-offer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const id = (n: number) =>
  `94000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const email = (name: string) => `e2e-b4-${name}@proavenir.test`;
const TODAY = '2026-11-20';

const COMPANY = { A: id(1), B: id(2), PENDING: id(3), REJECTED: id(4) };
const USER = {
  a: id(11),
  b: id(12),
  pending: id(13),
  rejected: id(14),
  orphan: id(15),
  inactive: id(16),
  candidate1: id(17),
  candidate2: id(18),
  admin: id(19),
};
const PROFILE = { candidate1: id(27), candidate2: id(28) };
const OFFER = {
  aDraft: id(31),
  aPublished: id(32),
  aExpired: id(33),
  aClosed: id(34),
  aLastDay: id(35),
  bPublished: id(36),
  pendingDraft: id(37),
  rejectedDraft: id(38),
};
const APPLICATION_IDS = [id(41), id(42), id(43)];

/** Champs exacts renvoyés pour une offre : rien de plus (aucune donnée sensible). */
const OFFER_FIELDS = [
  'applicationsCount',
  'city',
  'closedAt',
  'contractType',
  'createdAt',
  'deadline',
  'description',
  'domain',
  'duration',
  'featured',
  'id',
  'publiclyVisible',
  'publishedAt',
  'skills',
  'status',
  'title',
  'type',
  'updatedAt',
  'workSchedule',
];

describe('Offres de l’entreprise connectée (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const token = (userId: string, role: UserRole) =>
    jwt.sign({ sub: userId, role });
  const listAs = (userId: string, role: UserRole = 'COMPANY', path = '') =>
    http()
      .get(`/api/companies/me/offers${path}`)
      .set('Authorization', `Bearer ${token(userId, role)}`);
  const offersOf = async (userId: string) => {
    const res = await listAs(userId).expect(200);
    return res.body as CompanyOffersResponse;
  };
  const ids = (body: CompanyOffersResponse) => body.data.map((o) => o.id);

  /** Supprime UNIQUEMENT les lignes créées par ce fichier (ordre imposé par les relations). */
  const removeTestRows = async () => {
    const companyIds = Object.values(COMPANY);
    await prisma.application.deleteMany({
      where: { id: { in: APPLICATION_IDS } },
    });
    await prisma.offer.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-b4-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        { id: COMPANY.A, name: '[e2e-b4] Entreprise A', status: 'APPROVED' },
        { id: COMPANY.B, name: '[e2e-b4] Entreprise B', status: 'APPROVED' },
        {
          id: COMPANY.PENDING,
          name: '[e2e-b4] En attente',
          status: 'PENDING',
        },
        {
          id: COMPANY.REJECTED,
          name: '[e2e-b4] Refusée',
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
        { ...user(USER.inactive, 'inactive', 'COMPANY'), isActive: false },
        user(USER.candidate1, 'candidate1', 'CANDIDATE'),
        user(USER.candidate2, 'candidate2', 'CANDIDATE'),
        user(USER.admin, 'admin', 'ADMIN'),
      ],
    });
    await prisma.companyMember.createMany({
      data: [
        { companyId: COMPANY.A, userId: USER.a },
        { companyId: COMPANY.B, userId: USER.b },
        { companyId: COMPANY.PENDING, userId: USER.pending },
        { companyId: COMPANY.REJECTED, userId: USER.rejected },
        // Membre de l'entreprise A, mais compte désactivé.
        { companyId: COMPANY.A, userId: USER.inactive, role: 'RECRUITER' },
      ],
    });
    await prisma.candidateProfile.createMany({
      data: [
        { id: PROFILE.candidate1, userId: USER.candidate1 },
        { id: PROFILE.candidate2, userId: USER.candidate2 },
      ],
    });

    const base = {
      type: 'JOB' as const,
      cityId: 'conakry',
      domainId: 'commerce',
      description: 'Offre de test automatique pour l’espace entreprise.',
      skills: ['Test'],
    };
    const published = {
      status: 'PUBLISHED' as const,
      publishedAt: new Date('2026-11-01T12:00:00Z'),
    };
    await prisma.offer.createMany({
      data: [
        {
          ...base,
          id: OFFER.aDraft,
          companyId: COMPANY.A,
          title: '[e2e-b4] A brouillon',
          status: 'DRAFT',
          createdAt: new Date('2026-11-01T08:00:00Z'),
        },
        {
          ...base,
          ...published,
          id: OFFER.aPublished,
          companyId: COMPANY.A,
          title: '[e2e-b4] A publiée',
          type: 'INTERNSHIP',
          contractType: 'INTERNSHIP',
          duration: '6 mois',
          deadline: new Date('2026-12-31'),
          createdAt: new Date('2026-11-02T08:00:00Z'),
        },
        {
          ...base,
          ...published,
          id: OFFER.aExpired,
          companyId: COMPANY.A,
          title: '[e2e-b4] A expirée',
          deadline: new Date('2026-11-19'),
          createdAt: new Date('2026-11-03T08:00:00Z'),
        },
        {
          ...base,
          ...published,
          id: OFFER.aClosed,
          companyId: COMPANY.A,
          title: '[e2e-b4] A clôturée',
          status: 'CLOSED',
          deadline: new Date('2026-12-31'),
          closedAt: new Date('2026-11-10T09:00:00Z'),
          createdAt: new Date('2026-11-04T08:00:00Z'),
        },
        {
          ...base,
          ...published,
          id: OFFER.aLastDay,
          companyId: COMPANY.A,
          title: '[e2e-b4] A dernier jour',
          deadline: new Date(TODAY),
          createdAt: new Date('2026-11-05T08:00:00Z'),
        },
        {
          ...base,
          ...published,
          id: OFFER.bPublished,
          companyId: COMPANY.B,
          title: '[e2e-b4] B publiée',
          deadline: new Date('2026-12-31'),
        },
        {
          ...base,
          id: OFFER.pendingDraft,
          companyId: COMPANY.PENDING,
          title: '[e2e-b4] En attente brouillon',
          status: 'DRAFT',
        },
        {
          ...base,
          id: OFFER.rejectedDraft,
          companyId: COMPANY.REJECTED,
          title: '[e2e-b4] Refusée brouillon',
          status: 'DRAFT',
        },
      ],
    });
    await prisma.application.createMany({
      data: [
        {
          id: APPLICATION_IDS[0],
          offerId: OFFER.aPublished,
          candidateId: PROFILE.candidate1,
        },
        {
          id: APPLICATION_IDS[1],
          offerId: OFFER.aPublished,
          candidateId: PROFILE.candidate2,
        },
        {
          id: APPLICATION_IDS[2],
          offerId: OFFER.aClosed,
          candidateId: PROFILE.candidate1,
        },
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
    it('refuse une requête sans jeton (401)', async () => {
      const res = await http().get('/api/companies/me/offers').expect(401);
      expect(res.body.message).toBe('Connexion requise.');
    });

    it('refuse un jeton signé avec une autre clé (401)', async () => {
      const forged = new JwtService({ secret: 'x'.repeat(48) }).sign({
        sub: USER.a,
        role: 'COMPANY',
      });
      await http()
        .get('/api/companies/me/offers')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('refuse un candidat et un administrateur (403)', async () => {
      const candidate = await listAs(USER.candidate1, 'CANDIDATE').expect(403);
      expect(candidate.body.message).toBe('Accès réservé.');
      await listAs(USER.admin, 'ADMIN').expect(403);
    });

    it('utilise le rôle enregistré en base, pas celui écrit dans le jeton', async () => {
      // Jeton valide d'un candidat qui prétend être une entreprise.
      await listAs(USER.candidate1, 'COMPANY').expect(403);
    });

    it('refuse un compte entreprise rattaché à aucune entreprise (403)', async () => {
      const res = await listAs(USER.orphan).expect(403);
      expect(res.body.message).toBe(NO_COMPANY_MESSAGE);
    });

    it('refuse un compte désactivé, même membre d’une entreprise (401)', async () => {
      await listAs(USER.inactive).expect(401);
    });
  });

  describe('Liste de l’entreprise A', () => {
    it('renvoie toutes ses offres, tous statuts confondus, les plus récentes d’abord', async () => {
      const body = await offersOf(USER.a);
      expect(ids(body)).toEqual([
        OFFER.aLastDay,
        OFFER.aClosed,
        OFFER.aExpired,
        OFFER.aPublished,
        OFFER.aDraft,
      ]);
      expect(body.meta).toEqual({
        total: 5,
        today: TODAY,
        company: { name: '[e2e-b4] Entreprise A', status: 'APPROVED' },
      });
    });

    it('n’expose que les champs prévus (aucune donnée de compte ni de candidat)', async () => {
      const body = await offersOf(USER.a);
      for (const offer of body.data) {
        expect(Object.keys(offer).sort()).toEqual(OFFER_FIELDS);
      }
      const json = JSON.stringify(body);
      expect(json).not.toMatch(/@proavenir\.test|passwordHash|companyId/);
      for (const profileId of Object.values(PROFILE)) {
        expect(json).not.toContain(profileId);
      }
    });

    it('donne les statuts, dates et détails du contrat attendus', async () => {
      const byId = new Map((await offersOf(USER.a)).data.map((o) => [o.id, o]));
      expect(byId.get(OFFER.aDraft)).toMatchObject({
        status: 'DRAFT',
        deadline: null,
        publishedAt: null,
        closedAt: null,
        publiclyVisible: false,
      });
      expect(byId.get(OFFER.aPublished)).toMatchObject({
        status: 'PUBLISHED',
        type: 'INTERNSHIP',
        contractType: 'INTERNSHIP',
        duration: '6 mois',
        deadline: '2026-12-31',
        publishedAt: '2026-11-01T12:00:00.000Z',
        city: { id: 'conakry', name: 'Conakry' },
        domain: { id: 'commerce', name: 'Commerce' },
        publiclyVisible: true,
      });
      expect(byId.get(OFFER.aExpired)).toMatchObject({
        status: 'PUBLISHED',
        deadline: '2026-11-19',
        publiclyVisible: false,
      });
      expect(byId.get(OFFER.aLastDay)).toMatchObject({
        deadline: TODAY,
        publiclyVisible: true,
      });
      expect(byId.get(OFFER.aClosed)).toMatchObject({
        status: 'CLOSED',
        closedAt: '2026-11-10T09:00:00.000Z',
        publiclyVisible: false,
      });
    });

    it('compte les vraies candidatures de chaque offre', async () => {
      const counts = Object.fromEntries(
        (await offersOf(USER.a)).data.map((o) => [o.id, o.applicationsCount]),
      );
      expect(counts).toEqual({
        [OFFER.aLastDay]: 0,
        [OFFER.aClosed]: 1,
        [OFFER.aExpired]: 0,
        [OFFER.aPublished]: 2,
        [OFFER.aDraft]: 0,
      });
    });

    it('publiclyVisible correspond exactement à ce que montre l’API publique', async () => {
      const mine = await offersOf(USER.a);
      const publicRes = await http().get('/api/offers?q=e2e-b4').expect(200);
      const publicIds = (publicRes.body as PublicOffersResponse).data
        .map((o) => o.id)
        .filter((offerId) => ids(mine).includes(offerId))
        .sort();
      const visibleIds = mine.data
        .filter((o) => o.publiclyVisible)
        .map((o) => o.id)
        .sort();
      expect(publicIds).toEqual(visibleIds);
      expect(visibleIds).toEqual([OFFER.aPublished, OFFER.aLastDay].sort());
    });
  });

  describe('Cloisonnement entre entreprises', () => {
    it('l’entreprise B ne voit que sa propre offre', async () => {
      const body = await offersOf(USER.b);
      expect(ids(body)).toEqual([OFFER.bPublished]);
      expect(body.meta.company.name).toBe('[e2e-b4] Entreprise B');
    });

    it('ignore un identifiant d’entreprise passé dans l’adresse', async () => {
      const res = await listAs(
        USER.a,
        'COMPANY',
        `?companyId=${COMPANY.B}`,
      ).expect(200);
      const body = res.body as CompanyOffersResponse;
      expect(ids(body)).not.toContain(OFFER.bPublished);
      expect(body.meta.company.name).toBe('[e2e-b4] Entreprise A');
    });

    it('n’offre aucune route pour lire les offres d’une autre entreprise par son identifiant', async () => {
      await http()
        .get(`/api/companies/${COMPANY.B}/offers`)
        .set('Authorization', `Bearer ${token(USER.a, 'COMPANY')}`)
        .expect(404);
    });

    it('une entreprise en attente lit ses brouillons, jamais visibles publiquement', async () => {
      const body = await offersOf(USER.pending);
      expect(ids(body)).toEqual([OFFER.pendingDraft]);
      expect(body.meta.company.status).toBe('PENDING');
      expect(body.data[0].publiclyVisible).toBe(false);
    });

    it('une entreprise refusée garde un accès en lecture seule à ses offres', async () => {
      const body = await offersOf(USER.rejected);
      expect(ids(body)).toEqual([OFFER.rejectedDraft]);
      expect(body.meta.company.status).toBe('REJECTED');
    });
  });
});
