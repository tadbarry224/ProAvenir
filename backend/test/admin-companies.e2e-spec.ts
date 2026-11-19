/**
 * Tests de bout en bout de la vérification des entreprises par l'administration :
 * GET /api/admin/companies et PATCH /api/admin/companies/:id/status, sur la vraie base.
 *
 * Toutes les données utilisées sont des lignes de TEST créées ici puis retirées :
 * identifiants fixes « 95000000-… », e-mails « e2e-admin-…@proavenir.test »,
 * entreprises « [e2e-admin] … ». La liste renvoyée contient aussi les autres
 * entreprises de la base : les tests ne regardent QUE leurs propres lignes.
 * Les jetons d'accès sont signés directement par l'application (aucun mot de passe).
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type {
  AdminCompaniesResponse,
  AdminCompany,
} from '../src/admin-companies/admin-company.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const id = (n: number) =>
  `95000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const email = (name: string) => `e2e-admin-${name}@proavenir.test`;

const COMPANY = { pending: id(1), approved: id(2), other: id(3) };
const USER = { admin: id(11), owner: id(12), candidate: id(13) };
const OFFER = { published: id(21) };
const FAR_DEADLINE = new Date('2099-12-31');

/** Champs exacts renvoyés pour une entreprise : rien de plus (aucune donnée de compte). */
const COMPANY_FIELDS = [
  'city',
  'createdAt',
  'id',
  'name',
  'offersCount',
  'rejectionReason',
  'reviewedAt',
  'sector',
  'status',
];

describe('Vérification des entreprises par l’administration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const bearer = (userId: string, role: UserRole) =>
    `Bearer ${jwt.sign({ sub: userId, role })}`;
  const asAdmin = () => bearer(USER.admin, 'ADMIN');
  const listAsAdmin = async () => {
    const res = await http()
      .get('/api/admin/companies')
      .set('Authorization', asAdmin())
      .expect(200);
    return res.body as AdminCompaniesResponse;
  };
  /** Seulement les lignes de ce fichier (jamais les autres entreprises de la base). */
  const testCompanies = (body: AdminCompaniesResponse) =>
    body.data.filter((c) => Object.values(COMPANY).includes(c.id));
  const review = (companyId: string, body: object, auth = asAdmin()) =>
    http()
      .patch(`/api/admin/companies/${companyId}/status`)
      .set('Authorization', auth)
      .send(body);

  const removeTestRows = async () => {
    const companyIds = Object.values(COMPANY);
    await prisma.offer.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-admin-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        {
          id: COMPANY.pending,
          name: '[e2e-admin] En attente',
          status: 'PENDING',
          sector: 'Conseil',
          cityId: 'kindia',
          createdAt: new Date('2026-11-18T09:00:00Z'),
        },
        {
          id: COMPANY.approved,
          name: '[e2e-admin] Validée',
          status: 'APPROVED',
          reviewedAt: new Date('2026-11-02T09:00:00Z'),
          createdAt: new Date('2026-11-01T09:00:00Z'),
        },
        {
          id: COMPANY.other,
          name: '[e2e-admin] Autre attente',
          status: 'PENDING',
          createdAt: new Date('2026-11-10T09:00:00Z'),
        },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: USER.admin,
          email: email('admin'),
          fullName: 'E2E admin',
          role: 'ADMIN',
        },
        {
          id: USER.owner,
          email: email('owner'),
          fullName: 'E2E owner',
          role: 'COMPANY',
        },
        {
          id: USER.candidate,
          email: email('candidate'),
          fullName: 'E2E candidate',
          role: 'CANDIDATE',
        },
      ],
    });
    // Le compte entreprise appartient à l'entreprise en attente.
    await prisma.companyMember.create({
      data: { companyId: COMPANY.pending, userId: USER.owner },
    });
    await prisma.offer.create({
      data: {
        id: OFFER.published,
        companyId: COMPANY.approved,
        title: '[e2e-admin] Offre publiée',
        type: 'JOB',
        cityId: 'conakry',
        domainId: 'commerce',
        description: 'Offre de test automatique.',
        status: 'PUBLISHED',
        deadline: FAR_DEADLINE,
        publishedAt: new Date('2026-11-03T09:00:00Z'),
      },
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
    it('refuse une requête sans jeton (401)', async () => {
      await http().get('/api/admin/companies').expect(401);
      await http()
        .patch(`/api/admin/companies/${COMPANY.pending}/status`)
        .send({ status: 'APPROVED' })
        .expect(401);
    });

    it('refuse une entreprise et un candidat (403), sans rien modifier', async () => {
      for (const auth of [
        bearer(USER.owner, 'COMPANY'),
        bearer(USER.candidate, 'CANDIDATE'),
      ]) {
        await http()
          .get('/api/admin/companies')
          .set('Authorization', auth)
          .expect(403);
        await review(COMPANY.pending, { status: 'APPROVED' }, auth).expect(403);
      }
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: COMPANY.pending },
      });
      expect(company.status).toBe('PENDING');
    });
  });

  describe('Profil entreprise', () => {
    const path = '/api/companies/me/profile';
    const asOwner = () => bearer(USER.owner, 'COMPANY');

    it('charge et modifie le profil de la session, avec validation des champs', async () => {
      await http().get(path).expect(401);
      await http().get(path).set('Authorization', asAdmin()).expect(403);
      await http()
        .patch(path)
        .set('Authorization', asAdmin())
        .send({ sector: 'Commerce' })
        .expect(403);
      await http()
        .get(path)
        .set('Authorization', asOwner())
        .expect(200)
        .expect(({ body }) => expect(body.name).toBe('[e2e-admin] En attente'));

      for (const invalid of [
        { cityId: 'ville-inconnue' },
        { name: null },
        { contactEmail: 'invalide' },
        { phone: 'abc' },
        { status: 'APPROVED' },
        { companyId: COMPANY.other },
      ]) {
        await http()
          .patch(path)
          .set('Authorization', asOwner())
          .send(invalid)
          .expect(400);
      }

      await review(COMPANY.pending, { status: 'APPROVED' }).expect(200);
      const updated = await http()
        .patch(path)
        .set('Authorization', asOwner())
        .send({
          name: '  [e2e-admin]  En attente ',
          sector: ' Commerce ',
          cityId: 'conakry',
          description: 'Notre activité',
          contactEmail: 'contact@example.test',
          phone: '+224 620 00 00 00',
        })
        .expect(200);
      expect(updated.body).toEqual({
        name: '[e2e-admin] En attente',
        sector: 'Commerce',
        city: { id: 'conakry', name: 'Conakry' },
        description: 'Notre activité',
        contactEmail: 'contact@example.test',
        phone: '+224 620 00 00 00',
        status: 'APPROVED',
      });
      await http()
        .get(path)
        .set('Authorization', asOwner())
        .expect(200, updated.body);
      await http()
        .patch(path)
        .set('Authorization', asOwner())
        .send({ contactEmail: '', cityId: null })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            contactEmail: null,
            city: null,
            sector: 'Commerce',
          }),
        );
    });

    it('suspend les offres après un changement de nom jusqu’à la nouvelle approbation', async () => {
      await prisma.companyMember.update({
        where: { userId: USER.owner },
        data: { companyId: COMPANY.approved },
      });
      const offerPath = `/api/offers/${OFFER.published}`;
      await http().get(offerPath).expect(200);
      const name = '[e2e-admin] Nouveau nom';
      await http()
        .patch(path)
        .set('Authorization', asOwner())
        .send({ name })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({ name, status: 'PENDING' }),
        );
      await http().get(offerPath).expect(404);
      expect(
        testCompanies(await listAsAdmin()).find(
          (c) => c.id === COMPANY.approved,
        ),
      ).toMatchObject({
        name,
        status: 'PENDING',
        reviewedAt: null,
        rejectionReason: null,
      });

      const stale = await review(COMPANY.approved, {
        status: 'APPROVED',
        expectedName: '[e2e-admin] Validée',
      }).expect(409);
      expect(stale.body.code).toBe('COMPANY_IDENTITY_CHANGED');
      await review(COMPANY.approved, {
        status: 'APPROVED',
        expectedName: name,
      }).expect(200);
      await http()
        .get(offerPath)
        .expect(200)
        .expect(({ body }) => expect(body.company.name).toBe(name));
    });
  });

  describe('GET /api/admin/companies', () => {
    it('liste les entreprises, celles en attente d’abord', async () => {
      const body = await listAsAdmin();
      expect(testCompanies(body).map((c) => c.id)).toEqual([
        COMPANY.pending, // en attente, la plus récente
        COMPANY.other, // en attente
        COMPANY.approved,
      ]);
      expect(body.meta.total).toBe(body.data.length);
      expect(body.meta.pending).toBe(
        body.data.filter((c) => c.status === 'PENDING').length,
      );
    });

    it('n’expose que les champs prévus (aucune donnée de compte)', async () => {
      const [pending] = testCompanies(await listAsAdmin());
      expect(Object.keys(pending).sort()).toEqual(COMPANY_FIELDS);
      expect(pending).toEqual({
        id: COMPANY.pending,
        name: '[e2e-admin] En attente',
        sector: 'Conseil',
        city: { id: 'kindia', name: 'Kindia' },
        status: 'PENDING',
        rejectionReason: null,
        createdAt: '2026-11-18T09:00:00.000Z',
        reviewedAt: null,
        offersCount: 0,
      });
      expect(JSON.stringify(pending)).not.toMatch(/email|password|phone/i);
    });
  });

  describe('PATCH /api/admin/companies/:id/status', () => {
    it('approuve une entreprise : elle peut ensuite publier', async () => {
      const owner = bearer(USER.owner, 'COMPANY');
      const offer = {
        status: 'PUBLISHED',
        title: '[e2e-admin] Publication après validation',
        type: 'JOB',
        cityId: 'conakry',
        domainId: 'commerce',
        description:
          'Offre publiée juste après la validation de l’entreprise par l’administration.',
        deadline: '2099-12-31',
      };
      // Avant : en attente, publication refusée.
      const refused = await http()
        .post('/api/companies/me/offers')
        .set('Authorization', owner)
        .send(offer)
        .expect(403);
      expect(refused.body.code).toBe('COMPANY_NOT_APPROVED');

      const res = await review(COMPANY.pending, { status: 'APPROVED' }).expect(
        200,
      );
      const company = res.body as AdminCompany;
      expect(company).toMatchObject({
        id: COMPANY.pending,
        status: 'APPROVED',
        rejectionReason: null,
      });
      expect(company.reviewedAt).not.toBeNull();

      // Après : la même publication réussit.
      await http()
        .post('/api/companies/me/offers')
        .set('Authorization', owner)
        .send(offer)
        .expect(201);
    });

    it('refuse une entreprise avec un motif obligatoire', async () => {
      const missing = await review(COMPANY.pending, {
        status: 'REJECTED',
      }).expect(400);
      expect(missing.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        message: ['Le motif du refus est obligatoire.'],
      });

      const res = await review(COMPANY.pending, {
        status: 'REJECTED',
        reason: '  Numéro RCCM manquant. ',
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Numéro RCCM manquant.',
      });
    });

    it('refuser une entreprise validée retire ses offres de la liste publique', async () => {
      await http().get(`/api/offers/${OFFER.published}`).expect(200);
      await review(COMPANY.approved, {
        status: 'REJECTED',
        reason: 'Documents falsifiés.',
      }).expect(200);
      await http().get(`/api/offers/${OFFER.published}`).expect(404);

      // Revenir sur le refus : le motif est effacé et l'offre redevient publique.
      const res = await review(COMPANY.approved, {
        status: 'APPROVED',
      }).expect(200);
      expect(res.body.rejectionReason).toBeNull();
      await http().get(`/api/offers/${OFFER.published}`).expect(200);
    });

    it('refuse une décision qui ne change rien (409)', async () => {
      const res = await review(COMPANY.approved, {
        status: 'APPROVED',
      }).expect(409);
      expect(res.body).toMatchObject({
        code: 'COMPANY_ALREADY_IN_STATUS',
        message: 'Cette entreprise est déjà approuvée.',
      });
    });

    it('identifiant mal formé (400) ou inconnu (404)', async () => {
      const bad = await review('abc', { status: 'APPROVED' }).expect(400);
      expect(bad.body.code).toBe('INVALID_COMPANY_ID');
      const unknown = await review(id(99), { status: 'APPROVED' }).expect(404);
      expect(unknown.body).toMatchObject({
        code: 'COMPANY_NOT_FOUND',
        message: 'Entreprise introuvable.',
      });
    });

    it('refuse un retour « en attente » et les champs non prévus (400)', async () => {
      await review(COMPANY.pending, { status: 'PENDING' }).expect(400);
      await review(COMPANY.pending, {
        status: 'APPROVED',
        reviewedAt: '2020-01-01',
      }).expect(400);
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: COMPANY.pending },
      });
      expect(company.status).toBe('PENDING');
    });
  });
});
