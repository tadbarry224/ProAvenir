/**
 * Tests de bout en bout de PATCH /api/companies/me/offers/:id/status (B4.3) :
 * publier un brouillon, clôturer, rouvrir. Sur la vraie base.
 *
 * Données de TEST uniquement, créées ici puis retirées : identifiants fixes
 * « 94000000-…02xx », e-mails « e2e-b43-…@proavenir.test », entreprises
 * « [e2e-b43] … » et leurs offres. Les données de départ et les comptes réels ne
 * sont ni lus ni modifiés. Jetons signés directement par l'application (aucun mot
 * de passe). Date du jour simulée (ClockService).
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ClockService } from '../src/common/clock.service.js';
import type { CompanyOffer } from '../src/company-offers/company-offer.js';
import { NO_COMPANY_MESSAGE } from '../src/company-offers/company-membership.service.js';
import { OFFER_NOT_FOUND } from '../src/company-offers/company-offers.service.js';
import { STATUS_MESSAGES } from '../src/company-offers/offer-rules.js';
import type { OfferStatus, UserRole } from '../src/generated/prisma/enums.js';
import type { PublicOffersResponse } from '../src/offers/public-offer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const id = (n: number) =>
  `94000000-0000-4000-8000-${String(200 + n).padStart(12, '0')}`;
const email = (name: string) => `e2e-b43-${name}@proavenir.test`;
const TODAY = '2026-11-20';
const TAG = '[e2e-b43]';
const FIRST_PUBLICATION = new Date('2026-11-01T12:00:00.000Z');

const COMPANY = {
  A: id(1),
  B: id(2),
  PENDING: id(3),
  REJECTED: id(4),
  /** Entreprise refusée PENDANT une réouverture (test du verrou entreprise). */
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

describe('Statut des offres de l’entreprise connectée (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let counter = 0;

  const http = () => request(app.getHttpServer());
  const bearer = (userId: string, role: UserRole = 'COMPANY') =>
    `Bearer ${jwt.sign({ sub: userId, role })}`;
  const patchAs = (
    userId: string,
    offerId: string,
    body: Record<string, unknown>,
    role: UserRole = 'COMPANY',
  ) =>
    http()
      .patch(`/api/companies/me/offers/${offerId}/status`)
      .set('Authorization', bearer(userId, role))
      .send(body);
  const publish = (userId: string, offerId: string) =>
    patchAs(userId, offerId, { status: 'PUBLISHED' });
  const close = (userId: string, offerId: string) =>
    patchAs(userId, offerId, { status: 'CLOSED' });

  /** Identifiants des offres de test visibles dans l'API publique. */
  const publicIds = async () => {
    const res = await http().get('/api/offers?q=e2e-b43').expect(200);
    return (res.body as PublicOffersResponse).data.map((o) => o.id);
  };
  const stored = (offerId: string) =>
    prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      select: { status: true, publishedAt: true, closedAt: true },
    });

  /**
   * Crée une offre de test (complète par défaut) et renvoie son identifiant.
   * Les offres non brouillon ont une date de publication (contrainte CHECK).
   */
  const makeOffer = async (
    companyId: string,
    status: OfferStatus,
    overrides: { deadline?: string | null; description?: string } = {},
  ) => {
    counter += 1;
    const deadline =
      overrides.deadline === undefined ? '2026-12-31' : overrides.deadline;
    const offer = await prisma.offer.create({
      data: {
        companyId,
        status,
        title: `${TAG} Offre ${counter}`,
        type: 'JOB',
        cityId: 'conakry',
        domainId: 'commerce',
        description:
          overrides.description ??
          'Vous rejoindrez une équipe dynamique et participerez aux projets de l’entreprise.',
        deadline: deadline ? new Date(deadline) : null,
        publishedAt: status === 'DRAFT' ? null : FIRST_PUBLICATION,
        closedAt: status === 'CLOSED' ? new Date('2026-11-10T09:00:00Z') : null,
      },
      select: { id: true },
    });
    return offer.id;
  };

  /** Supprime UNIQUEMENT les lignes de ce fichier (offres d'abord : relation Restrict). */
  const removeTestRows = async () => {
    const companyIds = Object.values(COMPANY);
    await prisma.offer.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-b43-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        { id: COMPANY.A, name: `${TAG} Entreprise A`, status: 'APPROVED' },
        { id: COMPANY.B, name: `${TAG} Entreprise B`, status: 'APPROVED' },
        { id: COMPANY.PENDING, name: `${TAG} En attente`, status: 'PENDING' },
        {
          id: COMPANY.REJECTED,
          name: `${TAG} Refusée`,
          status: 'REJECTED',
          rejectionReason: 'Test automatique',
        },
        { id: COMPANY.RACE, name: `${TAG} Concurrence`, status: 'APPROVED' },
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

  describe('Accès et validation de la requête', () => {
    it('refuse une requête sans jeton (401), l’offre ne change pas', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      await http()
        .patch(`/api/companies/me/offers/${offerId}/status`)
        .send({ status: 'CLOSED' })
        .expect(401);
      expect((await stored(offerId)).status).toBe('PUBLISHED');
    });

    it('refuse un candidat et un administrateur (403)', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      await patchAs(
        USER.candidate,
        offerId,
        { status: 'CLOSED' },
        'CANDIDATE',
      ).expect(403);
      await patchAs(USER.admin, offerId, { status: 'CLOSED' }, 'ADMIN').expect(
        403,
      );
      expect((await stored(offerId)).status).toBe('PUBLISHED');
    });

    it('refuse un compte entreprise sans entreprise (403)', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      const res = await close(USER.orphan, offerId).expect(403);
      expect(res.body.message).toBe(NO_COMPANY_MESSAGE);
      expect(res.body.code).toBe('NO_COMPANY');
    });

    it('refuse un identifiant d’offre mal formé (400)', async () => {
      const res = await close(USER.a, 'pas-un-uuid').expect(400);
      expect(res.body.message).toBe('Identifiant d’offre invalide.');
      expect(res.body.code).toBe('INVALID_OFFER_ID');
    });

    it.each([
      [{ status: 'DRAFT' }, 'Le statut doit valoir PUBLISHED'],
      [{ status: 'ARCHIVED' }, 'Le statut doit valoir PUBLISHED'],
      [{}, 'Le statut doit valoir PUBLISHED'],
      [
        { status: 'CLOSED', closedAt: null },
        'property closedAt should not exist',
      ],
      [
        { status: 'CLOSED', companyId: COMPANY.A },
        'property companyId should not exist',
      ],
    ])('refuse le corps %o (400)', async (body, expected) => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      const res = await patchAs(USER.a, offerId, body).expect(400);
      expect(res.body.message.join(' | ')).toContain(expected);
      expect((await stored(offerId)).status).toBe('PUBLISHED');
    });
  });

  describe('Propriété de l’offre', () => {
    it('l’offre d’une autre entreprise est introuvable (404) et reste inchangée', async () => {
      const offerOfB = await makeOffer(COMPANY.B, 'PUBLISHED');
      const res = await close(USER.a, offerOfB).expect(404);
      expect(res.body.message).toBe(OFFER_NOT_FOUND);
      expect(res.body.code).toBe('OFFER_NOT_FOUND');
      expect((await stored(offerOfB)).status).toBe('PUBLISHED');
      expect(await publicIds()).toContain(offerOfB);
    });

    it('même réponse (404) pour une offre qui n’existe pas', async () => {
      const res = await close(USER.a, id(99)).expect(404);
      expect(res.body.message).toBe(OFFER_NOT_FOUND);
      expect(res.body.code).toBe('OFFER_NOT_FOUND');
    });

    it('le brouillon d’une autre entreprise ne peut pas être publié (404)', async () => {
      const draftOfB = await makeOffer(COMPANY.B, 'DRAFT');
      await publish(USER.a, draftOfB).expect(404);
      expect((await stored(draftOfB)).status).toBe('DRAFT');
      expect(await publicIds()).not.toContain(draftOfB);
    });
  });

  describe('Transitions autorisées (entreprise validée)', () => {
    it('publie un brouillon complet : visible publiquement', async () => {
      const offerId = await makeOffer(COMPANY.A, 'DRAFT');
      expect(await publicIds()).not.toContain(offerId);

      const before = Date.now();
      const res = await publish(USER.a, offerId).expect(200);
      const offer = res.body as CompanyOffer;
      expect(offer).toMatchObject({
        id: offerId,
        status: 'PUBLISHED',
        closedAt: null,
        publiclyVisible: true,
      });
      expect(Date.parse(offer.publishedAt ?? '')).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(await publicIds()).toContain(offerId);
    });

    it('clôture une offre publiée : retirée de l’API publique', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      expect(await publicIds()).toContain(offerId);

      const res = await close(USER.a, offerId).expect(200);
      expect(res.body).toMatchObject({
        status: 'CLOSED',
        publishedAt: FIRST_PUBLICATION.toISOString(),
        publiclyVisible: false,
      });
      expect(res.body.closedAt).not.toBeNull();
      expect(await publicIds()).not.toContain(offerId);
    });

    it('rouvre une offre clôturée (date à venir) : à nouveau visible, première publication conservée', async () => {
      const offerId = await makeOffer(COMPANY.A, 'CLOSED');
      expect(await publicIds()).not.toContain(offerId);

      const res = await publish(USER.a, offerId).expect(200);
      expect(res.body).toMatchObject({
        status: 'PUBLISHED',
        publishedAt: FIRST_PUBLICATION.toISOString(),
        closedAt: null,
        publiclyVisible: true,
      });
      expect(await publicIds()).toContain(offerId);
    });

    it('rouvre une offre dont la date limite est aujourd’hui', async () => {
      const offerId = await makeOffer(COMPANY.A, 'CLOSED', { deadline: TODAY });
      await publish(USER.a, offerId).expect(200);
      expect(await publicIds()).toContain(offerId);
    });

    it('clôture une offre expirée (déjà invisible publiquement)', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED', {
        deadline: '2026-11-19',
      });
      expect(await publicIds()).not.toContain(offerId);
      const res = await close(USER.a, offerId).expect(200);
      expect(res.body.status).toBe('CLOSED');
      expect(await publicIds()).not.toContain(offerId);
    });

    it('cycle complet publier → clôturer → rouvrir, visibilité vérifiée à chaque étape', async () => {
      const offerId = await makeOffer(COMPANY.A, 'DRAFT');
      const steps: [() => request.Test, OfferStatus, boolean][] = [
        [() => publish(USER.a, offerId), 'PUBLISHED', true],
        [() => close(USER.a, offerId), 'CLOSED', false],
        [() => publish(USER.a, offerId), 'PUBLISHED', true],
        [() => close(USER.a, offerId), 'CLOSED', false],
      ];
      let firstPublishedAt: string | undefined;
      for (const [action, status, visible] of steps) {
        const res = await action().expect(200);
        expect(res.body.status).toBe(status);
        firstPublishedAt ??= res.body.publishedAt;
        expect(res.body.publishedAt).toBe(firstPublishedAt);
        expect((await publicIds()).includes(offerId)).toBe(visible);
      }
    });
  });

  describe('Transitions refusées (409), l’offre ne change pas', () => {
    const expect409 = async (
      offerId: string,
      action: () => request.Test,
      expected: string,
      code = 'INVALID_STATUS_TRANSITION',
    ) => {
      const before = await stored(offerId);
      const res = await action().expect(409);
      expect(res.body.code).toBe(code);
      expect([res.body.message].flat().join(' ')).toContain(expected);
      expect(await stored(offerId)).toEqual(before);
    };

    it('clôturer un brouillon', async () => {
      const offerId = await makeOffer(COMPANY.A, 'DRAFT');
      await expect409(
        offerId,
        () => close(USER.a, offerId),
        STATUS_MESSAGES.draftCannotClose,
      );
    });

    it('republier une offre publiée, reclôturer une offre clôturée', async () => {
      const published = await makeOffer(COMPANY.A, 'PUBLISHED');
      await expect409(
        published,
        () => publish(USER.a, published),
        STATUS_MESSAGES.alreadyPublished,
      );
      const closed = await makeOffer(COMPANY.A, 'CLOSED');
      await expect409(
        closed,
        () => close(USER.a, closed),
        STATUS_MESSAGES.alreadyClosed,
      );
    });

    it('rouvrir une offre clôturée dont la date limite est passée : reste invisible', async () => {
      const offerId = await makeOffer(COMPANY.A, 'CLOSED', {
        deadline: '2026-11-19',
      });
      await expect409(
        offerId,
        () => publish(USER.a, offerId),
        'La date limite ne peut pas être dans le passé.',
        'OFFER_NOT_PUBLISHABLE',
      );
      expect(await publicIds()).not.toContain(offerId);
    });

    it('publier un brouillon expiré ou incomplet', async () => {
      const expired = await makeOffer(COMPANY.A, 'DRAFT', {
        deadline: '2026-11-19',
      });
      await expect409(
        expired,
        () => publish(USER.a, expired),
        'La date limite ne peut pas être dans le passé.',
        'OFFER_NOT_PUBLISHABLE',
      );

      const incomplete = await makeOffer(COMPANY.A, 'DRAFT', {
        deadline: null,
        description: 'Trop court',
      });
      const res = await publish(USER.a, incomplete).expect(409);
      // Format complet : code stable + détails par champ, distinct d'une transition interdite.
      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        code: 'OFFER_NOT_PUBLISHABLE',
        details: [
          {
            field: 'description',
            message:
              'La description doit contenir au moins 50 caractères pour publier (actuellement 10).',
          },
          {
            field: 'deadline',
            message: 'La date limite est obligatoire pour publier.',
          },
        ],
      });
      expect(res.body.message).toEqual([
        'La description doit contenir au moins 50 caractères pour publier (actuellement 10).',
        'La date limite est obligatoire pour publier.',
      ]);
      expect((await stored(incomplete)).status).toBe('DRAFT');
    });
  });

  describe('Statut de l’entreprise', () => {
    it('en attente (PENDING) : ni publication ni réouverture (403)', async () => {
      const draft = await makeOffer(COMPANY.PENDING, 'DRAFT');
      const closed = await makeOffer(COMPANY.PENDING, 'CLOSED');
      for (const offerId of [draft, closed]) {
        const res = await publish(USER.pending, offerId).expect(403);
        expect(res.body.message).toBe(STATUS_MESSAGES.approvalRequired);
        expect(res.body.code).toBe('COMPANY_NOT_APPROVED');
      }
      expect((await stored(draft)).status).toBe('DRAFT');
      expect((await stored(closed)).status).toBe('CLOSED');
    });

    it('en attente (PENDING) : peut clôturer une offre publiée', async () => {
      // Cas d'une entreprise repassée « en attente » après avoir publié.
      const offerId = await makeOffer(COMPANY.PENDING, 'PUBLISHED');
      await close(USER.pending, offerId).expect(200);
      expect((await stored(offerId)).status).toBe('CLOSED');
    });

    it('refusée (REJECTED) : lecture seule, aucun changement (403)', async () => {
      const draft = await makeOffer(COMPANY.REJECTED, 'DRAFT');
      const published = await makeOffer(COMPANY.REJECTED, 'PUBLISHED');
      for (const [offerId, action] of [
        [draft, publish],
        [published, close],
      ] as const) {
        const res = await action(USER.rejected, offerId).expect(403);
        expect(res.body.message).toBe(STATUS_MESSAGES.rejectedReadOnly);
        expect(res.body.code).toBe('COMPANY_REJECTED');
      }
      expect((await stored(draft)).status).toBe('DRAFT');
      expect((await stored(published)).status).toBe('PUBLISHED');
    });
  });

  describe('Requêtes concurrentes', () => {
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    it('deux clôtures simultanées : une seule réussit, l’autre reçoit 409', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      const responses = await Promise.all([
        close(USER.a, offerId),
        close(USER.a, offerId),
      ]);
      const statuses = responses.map((res) => res.status).sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);
      const winner = responses.find((res) => res.status === 200);
      expect((await stored(offerId)).closedAt?.toISOString()).toBe(
        winner?.body.closedAt,
      );
    });

    it('une demande attend qu’une modification en cours de la même offre soit terminée, puis en tient compte', async () => {
      const offerId = await makeOffer(COMPANY.A, 'PUBLISHED');
      let settled = false;

      // Une autre opération clôture l'offre sans valider tout de suite.
      const attempt = await prisma.$transaction(async (tx) => {
        await tx.offer.update({
          where: { id: offerId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        const pending = close(USER.a, offerId).then((res) => {
          settled = true;
          return res;
        });
        await sleep(500);
        expect(settled).toBe(false); // bloquée par le verrou de l'offre (FOR UPDATE)
        return { pending };
      });

      // Après validation, la demande voit l'offre déjà clôturée.
      const res = await attempt.pending;
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(STATUS_MESSAGES.alreadyClosed);
    });

    it('une réouverture attend la fin d’un refus de l’entreprise en cours, puis le respecte', async () => {
      const offerId = await makeOffer(COMPANY.RACE, 'CLOSED');
      let settled = false;

      const attempt = await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: COMPANY.RACE },
          data: { status: 'REJECTED', rejectionReason: 'Test automatique' },
        });
        const pending = publish(USER.race, offerId).then((res) => {
          settled = true;
          return res;
        });
        await sleep(500);
        expect(settled).toBe(false); // bloquée par le verrou de l'entreprise (FOR SHARE)
        return { pending };
      });

      const res = await attempt.pending;
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(STATUS_MESSAGES.rejectedReadOnly);
      expect((await stored(offerId)).status).toBe('CLOSED');
      expect(await publicIds()).not.toContain(offerId);
    });
  });
});
