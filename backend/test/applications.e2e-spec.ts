/**
 * Tests de bout en bout des candidatures (B5), sur la vraie base :
 *   POST|GET /api/candidates/me/applications
 *   GET /api/companies/me/applications, PATCH /api/companies/me/applications/:id/status
 *
 * Toutes les données sont des lignes de TEST créées ici puis retirées :
 * identifiants fixes « 96000000-… », e-mails « e2e-b5-…@proavenir.test »,
 * entreprises et offres « [e2e-b5] … ». Les données de départ et les comptes réels
 * ne sont ni lus ni modifiés. Jetons signés directement par l'application.
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type {
  CandidateApplication,
  CandidateApplicationsResponse,
  ReceivedApplicationsResponse,
} from '../src/applications/application.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const id = (n: number) =>
  `96000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const email = (name: string) => `e2e-b5-${name}@proavenir.test`;

const COMPANY = { A: id(1), B: id(2), R: id(3) };
const USER = {
  ownerA: id(11),
  ownerB: id(12),
  ownerR: id(13),
  c1: id(14),
  c2: id(15),
  noProfile: id(16),
};
const PROFILE = { c1: id(21), c2: id(22) };
const OFFER = {
  aOpen: id(31),
  aClosed: id(32),
  aExpired: id(33),
  aDraft: id(34),
  bOpen: id(35),
  rOpen: id(36),
};
const FAR = new Date('2099-12-31');

describe('Candidatures (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const bearer = (userId: string, role: UserRole) =>
    `Bearer ${jwt.sign({ sub: userId, role })}`;
  const apply = (userId: string, body: object) =>
    http()
      .post('/api/candidates/me/applications')
      .set('Authorization', bearer(userId, 'CANDIDATE'))
      .send(body);
  const mine = async (userId: string) => {
    const res = await http()
      .get('/api/candidates/me/applications')
      .set('Authorization', bearer(userId, 'CANDIDATE'))
      .expect(200);
    return res.body as CandidateApplicationsResponse;
  };
  const received = async (userId: string) => {
    const res = await http()
      .get('/api/companies/me/applications')
      .set('Authorization', bearer(userId, 'COMPANY'))
      .expect(200);
    return res.body as ReceivedApplicationsResponse;
  };
  const changeStatus = (
    userId: string,
    applicationId: string,
    status: string,
  ) =>
    http()
      .patch(`/api/companies/me/applications/${applicationId}/status`)
      .set('Authorization', bearer(userId, 'COMPANY'))
      .send({ status });

  const removeTestRows = async () => {
    const offerIds = Object.values(OFFER);
    await prisma.application.deleteMany({
      where: { offerId: { in: offerIds } },
    });
    await prisma.offer.deleteMany({ where: { id: { in: offerIds } } });
    await prisma.company.deleteMany({
      where: { id: { in: Object.values(COMPANY) } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-b5-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        { id: COMPANY.A, name: '[e2e-b5] Entreprise A', status: 'APPROVED' },
        { id: COMPANY.B, name: '[e2e-b5] Entreprise B', status: 'APPROVED' },
        {
          id: COMPANY.R,
          name: '[e2e-b5] Refusée',
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
        user(USER.ownerA, 'owner-a', 'COMPANY'),
        user(USER.ownerB, 'owner-b', 'COMPANY'),
        user(USER.ownerR, 'owner-r', 'COMPANY'),
        user(USER.c1, 'c1', 'CANDIDATE'),
        user(USER.c2, 'c2', 'CANDIDATE'),
        user(USER.noProfile, 'no-profile', 'CANDIDATE'),
      ],
    });
    await prisma.companyMember.createMany({
      data: [
        { companyId: COMPANY.A, userId: USER.ownerA },
        { companyId: COMPANY.B, userId: USER.ownerB },
        { companyId: COMPANY.R, userId: USER.ownerR },
      ],
    });
    await prisma.candidateProfile.createMany({
      data: [
        {
          id: PROFILE.c1,
          userId: USER.c1,
          cityId: 'kindia',
          education: 'Licence de gestion',
          skills: ['Excel', 'Comptabilité'],
          cvFileName: 'cv-e2e.pdf',
        },
        { id: PROFILE.c2, userId: USER.c2 },
      ],
    });
    const offer = (
      offerId: string,
      companyId: string,
      title: string,
      extra: object = {},
    ) => ({
      id: offerId,
      companyId,
      title: `[e2e-b5] ${title}`,
      type: 'JOB' as const,
      cityId: 'conakry',
      domainId: 'commerce',
      description: 'Offre de test automatique pour les candidatures.',
      status: 'PUBLISHED' as const,
      deadline: FAR,
      publishedAt: new Date('2026-11-01T12:00:00Z'),
      ...extra,
    });
    await prisma.offer.createMany({
      data: [
        offer(OFFER.aOpen, COMPANY.A, 'Ouverte A'),
        offer(OFFER.aClosed, COMPANY.A, 'Clôturée', {
          status: 'CLOSED',
          closedAt: new Date(),
        }),
        offer(OFFER.aExpired, COMPANY.A, 'Expirée', {
          deadline: new Date('2020-01-01'),
        }),
        offer(OFFER.aDraft, COMPANY.A, 'Brouillon', {
          status: 'DRAFT',
          deadline: null,
          publishedAt: null,
        }),
        offer(OFFER.bOpen, COMPANY.B, 'Ouverte B'),
        offer(OFFER.rOpen, COMPANY.R, 'Entreprise refusée'),
      ],
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await removeTestRows(); // restes éventuels d'une exécution interrompue
  });

  beforeEach(async () => {
    await removeTestRows();
    await seedTestRows();
  });

  afterAll(async () => {
    await removeTestRows();
    await app.close();
  });

  describe('Accès', () => {
    it('refuse sans jeton (401) et avec le mauvais rôle (403)', async () => {
      await http().get('/api/candidates/me/applications').expect(401);
      await http().get('/api/companies/me/applications').expect(401);
      await http()
        .post('/api/candidates/me/applications')
        .set('Authorization', bearer(USER.ownerA, 'COMPANY'))
        .send({ offerId: OFFER.aOpen })
        .expect(403);
      await http()
        .get('/api/companies/me/applications')
        .set('Authorization', bearer(USER.c1, 'CANDIDATE'))
        .expect(403);
    });

    it('un compte candidat sans profil ne peut pas postuler (403)', async () => {
      const res = await apply(USER.noProfile, { offerId: OFFER.aOpen }).expect(
        403,
      );
      expect(res.body.code).toBe('NO_CANDIDATE_PROFILE');
    });
  });

  describe('Postuler', () => {
    it('crée la candidature (201), avec le message et le CV actuel du profil', async () => {
      const res = await apply(USER.c1, {
        offerId: OFFER.aOpen,
        message: '  Je suis très motivée.  ',
      }).expect(201);
      const application = res.body as CandidateApplication;
      expect(application).toMatchObject({
        status: 'SENT',
        message: 'Je suis très motivée.',
        offer: {
          id: OFFER.aOpen,
          title: '[e2e-b5] Ouverte A',
          type: 'JOB',
          city: { id: 'conakry', name: 'Conakry' },
          company: { name: '[e2e-b5] Entreprise A', logoColor: 'blue' },
          publiclyVisible: true,
        },
      });
      expect(Object.keys(application).sort()).toEqual(
        ['createdAt', 'id', 'message', 'offer', 'status', 'updatedAt'].sort(),
      );
      const row = await prisma.application.findUniqueOrThrow({
        where: { id: application.id },
      });
      expect(row.candidateId).toBe(PROFILE.c1);
      expect(row.cvFileName).toBe('cv-e2e.pdf');
    });

    it('refuse de postuler deux fois à la même offre (409)', async () => {
      await apply(USER.c1, { offerId: OFFER.aOpen }).expect(201);
      const res = await apply(USER.c1, { offerId: OFFER.aOpen }).expect(409);
      expect(res.body).toMatchObject({
        code: 'ALREADY_APPLIED',
        message: 'Vous avez déjà postulé à cette offre.',
      });
    });

    it('deux envois simultanés : une seule candidature est créée', async () => {
      const results = await Promise.all([
        apply(USER.c2, { offerId: OFFER.aOpen }),
        apply(USER.c2, { offerId: OFFER.aOpen }),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(
        await prisma.application.count({
          where: { offerId: OFFER.aOpen, candidateId: PROFILE.c2 },
        }),
      ).toBe(1);
    });

    it('refuse une offre qui n’est pas publique (404 OFFER_NOT_AVAILABLE)', async () => {
      for (const offerId of [
        OFFER.aClosed,
        OFFER.aExpired,
        OFFER.aDraft,
        OFFER.rOpen,
        id(99),
      ]) {
        const res = await apply(USER.c1, { offerId }).expect(404);
        expect(res.body.code).toBe('OFFER_NOT_AVAILABLE');
      }
      expect(
        await prisma.application.count({ where: { candidateId: PROFILE.c1 } }),
      ).toBe(0);
    });

    it('refuse un corps invalide ou des champs imposés (400)', async () => {
      await apply(USER.c1, { offerId: 'abc' }).expect(400);
      await apply(USER.c1, { offerId: OFFER.aOpen, status: 'ACCEPTED' }).expect(
        400,
      );
      await apply(USER.c1, {
        offerId: OFFER.aOpen,
        candidateId: PROFILE.c2,
      }).expect(400);
    });
  });

  describe('Mes candidatures (candidat)', () => {
    it('ne montre que les siennes, et signale une offre qui n’est plus en ligne', async () => {
      await apply(USER.c1, { offerId: OFFER.aOpen }).expect(201);
      await apply(USER.c1, { offerId: OFFER.bOpen }).expect(201);
      await apply(USER.c2, { offerId: OFFER.aOpen }).expect(201);

      const list = await mine(USER.c1);
      expect(list.meta.total).toBe(2);
      expect(list.data.map((a) => a.offer.id).sort()).toEqual(
        [OFFER.aOpen, OFFER.bOpen].sort(),
      );

      await prisma.offer.update({
        where: { id: OFFER.bOpen },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      const after = await mine(USER.c1);
      const closed = after.data.find((a) => a.offer.id === OFFER.bOpen)!;
      expect(closed.offer.publiclyVisible).toBe(false);
    });
  });

  describe('Candidatures reçues (entreprise)', () => {
    it('ne montre que les candidatures à ses offres, avec le profil du candidat', async () => {
      await apply(USER.c1, {
        offerId: OFFER.aOpen,
        message: 'Bonjour',
      }).expect(201);
      await apply(USER.c2, { offerId: OFFER.bOpen }).expect(201);

      const listA = await received(USER.ownerA);
      expect(listA.meta.total).toBe(1);
      const [application] = listA.data;
      expect(application).toMatchObject({
        status: 'SENT',
        message: 'Bonjour',
        cvFileName: 'cv-e2e.pdf',
        offer: { id: OFFER.aOpen, title: '[e2e-b5] Ouverte A' },
        candidate: {
          fullName: 'E2E c1',
          email: email('c1'),
          city: { id: 'kindia', name: 'Kindia' },
          education: 'Licence de gestion',
          skills: ['Excel', 'Comptabilité'],
        },
      });
      expect(Object.keys(application.candidate).sort()).toEqual(
        ['city', 'education', 'email', 'fullName', 'skills'].sort(),
      );
      expect(JSON.stringify(application)).not.toMatch(
        /password|token|candidateId/i,
      );

      const listB = await received(USER.ownerB);
      expect(listB.data.map((a) => a.offer.id)).toEqual([OFFER.bOpen]);
    });
  });

  describe('Changer le statut (entreprise)', () => {
    const submit = async () => {
      const res = await apply(USER.c1, { offerId: OFFER.aOpen }).expect(201);
      return (res.body as CandidateApplication).id;
    };

    it('fait avancer la candidature ; le candidat voit le nouveau statut', async () => {
      const applicationId = await submit();
      for (const status of ['IN_REVIEW', 'SHORTLISTED', 'ACCEPTED']) {
        const res = await changeStatus(
          USER.ownerA,
          applicationId,
          status,
        ).expect(200);
        expect(res.body.status).toBe(status);
      }
      const [mineNow] = (await mine(USER.c1)).data;
      expect(mineNow.status).toBe('ACCEPTED');
    });

    it('refuse de sauter une étape ou de changer une réponse définitive (409)', async () => {
      const applicationId = await submit();
      const skip = await changeStatus(
        USER.ownerA,
        applicationId,
        'ACCEPTED',
      ).expect(409);
      expect(skip.body.code).toBe('INVALID_APPLICATION_TRANSITION');

      await changeStatus(USER.ownerA, applicationId, 'REJECTED').expect(200);
      const final = await changeStatus(
        USER.ownerA,
        applicationId,
        'IN_REVIEW',
      ).expect(409);
      expect(final.body.message).toBe(
        'Cette candidature est déjà refusée : son statut est définitif.',
      );
    });

    it('une autre entreprise ne peut ni voir ni modifier la candidature (404)', async () => {
      const applicationId = await submit();
      const res = await changeStatus(
        USER.ownerB,
        applicationId,
        'IN_REVIEW',
      ).expect(404);
      expect(res.body.code).toBe('APPLICATION_NOT_FOUND');
      const row = await prisma.application.findUniqueOrThrow({
        where: { id: applicationId },
      });
      expect(row.status).toBe('SENT');
    });

    it('une entreprise refusée est en lecture seule (403)', async () => {
      // Candidature déposée avant le refus de l'entreprise.
      const application = await prisma.application.create({
        data: { offerId: OFFER.rOpen, candidateId: PROFILE.c1 },
      });
      expect((await received(USER.ownerR)).meta.total).toBe(1);
      const res = await changeStatus(
        USER.ownerR,
        application.id,
        'IN_REVIEW',
      ).expect(403);
      expect(res.body.code).toBe('COMPANY_REJECTED');
    });

    it('identifiant mal formé (400) ou statut invalide (400)', async () => {
      const bad = await changeStatus(USER.ownerA, 'abc', 'IN_REVIEW').expect(
        400,
      );
      expect(bad.body.code).toBe('INVALID_APPLICATION_ID');
      const applicationId = await submit();
      await changeStatus(USER.ownerA, applicationId, 'SENT').expect(400);
    });
  });
});
