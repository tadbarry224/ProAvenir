/**
 * Tests de bout en bout de l'authentification (/api/auth/…), sur la vraie base.
 *
 * Les comptes créés ici utilisent des e-mails « e2e-auth-…@proavenir.test » et des
 * entreprises « [e2e-auth] … » : ils sont supprimés avant et après les tests.
 * Les données de départ ne sont jamais modifiées.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashRefreshToken } from '../src/auth/refresh-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const CSRF = { 'X-ProAvenir-CSRF': '1' };
const PASSWORD = 'Mot-de-passe-e2e-42';
const email = (name: string) => `e2e-auth-${name}@proavenir.test`;
const INVALID_CREDENTIALS = 'E-mail ou mot de passe incorrect.';

/** Extrait le cookie de session d'une réponse (valeur + attributs bruts). */
function refreshCookie(res: request.Response) {
  const raw = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('proavenir_refresh='));
  const value = raw?.split(';')[0].split('=')[1] ?? '';
  return { raw: raw ?? '', value, header: `proavenir_refresh=${value}` };
}

describe('Authentification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  const cleanup = async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-auth-' } },
    });
    await prisma.company.deleteMany({
      where: { name: { startsWith: '[e2e-auth]' } },
    });
  };

  const register = (body: Record<string, unknown>) =>
    http().post('/api/auth/register').set(CSRF).send(body);

  const registerCandidate = (name: string) =>
    register({
      role: 'CANDIDATE',
      fullName: 'Candidat E2E',
      email: email(name),
      password: PASSWORD,
    }).expect(201);

  const login = (name: string, extra: Record<string, unknown> = {}) =>
    http()
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: email(name), password: PASSWORD, ...extra });

  const refresh = (cookieHeader: string) =>
    http().post('/api/auth/refresh').set(CSRF).set('Cookie', cookieHeader);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  /**
   * Remet à zéro le compteur de tentatives (sinon les tests se bloqueraient
   * entre eux). Le stockage mémoire du limiteur tient deux tables.
   */
  const resetThrottle = () => {
    const storage = app.get<{
      storage: Map<string, unknown>;
      hitExpirations: Map<string, unknown>;
    }>(ThrottlerStorage);
    storage.storage.clear();
    storage.hitExpirations.clear();
  };

  beforeEach(resetThrottle);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('Inscription', () => {
    it('crée un candidat avec son profil, ouvre une session de 24 h et ne renvoie aucun hash', async () => {
      const res = await registerCandidate('candidat');
      expect(res.body).toMatchObject({
        expiresIn: 900,
        user: {
          email: email('candidat'),
          fullName: 'Candidat E2E',
          role: 'CANDIDATE',
          company: null,
        },
      });
      expect(typeof res.body.accessToken).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|argon/i);

      const cookie = refreshCookie(res);
      expect(cookie.raw).toMatch(/HttpOnly/i);
      expect(cookie.raw).toMatch(/SameSite=Strict/i);
      expect(cookie.raw).toMatch(/Path=\/api\/auth/i);
      expect(cookie.raw).not.toMatch(/Expires=/i); // cookie de session
      expect(cookie.raw).not.toMatch(/Secure/i); // HTTPS seulement en production

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: email('candidat') },
        include: { candidateProfile: true, refreshTokens: true },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.candidateProfile).not.toBeNull();
      const [session] = user.refreshTokens;
      // Seule l'empreinte du jeton est stockée, jamais le jeton lui-même.
      expect(session.tokenHash).toBe(hashRefreshToken(cookie.value));
      expect(session.tokenHash).not.toContain(cookie.value);
      expect(session.persistent).toBe(false);
      const hours = (session.expiresAt.getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24);
    });

    it('crée une entreprise EN ATTENTE et son compte propriétaire', async () => {
      const res = await register({
        role: 'COMPANY',
        fullName: 'Recruteur E2E',
        companyName: '[e2e-auth] Société test',
        email: email('entreprise'),
        password: PASSWORD,
      }).expect(201);
      expect(res.body.user).toMatchObject({
        role: 'COMPANY',
        company: { name: '[e2e-auth] Société test', status: 'PENDING' },
      });
      const member = await prisma.companyMember.findFirstOrThrow({
        where: { user: { email: email('entreprise') } },
        include: { company: true },
      });
      expect(member.role).toBe('OWNER');
      expect(member.company.status).toBe('PENDING');
    });

    it('refuse de créer un administrateur', async () => {
      const res = await register({
        role: 'ADMIN',
        fullName: 'Pirate',
        email: email('admin'),
        password: PASSWORD,
      }).expect(400);
      expect(res.body.message).toContain(
        'Le type de compte doit être Candidat ou Entreprise.',
      );
      expect(
        await prisma.user.count({ where: { email: email('admin') } }),
      ).toBe(0);
    });

    it('refuse les champs non prévus (rôle, statut, activation…)', async () => {
      await register({
        role: 'CANDIDATE',
        fullName: 'Candidat',
        email: email('extra'),
        password: PASSWORD,
        isActive: true,
        status: 'APPROVED',
      }).expect(400);
    });

    it('exige le nom de l’entreprise et un mot de passe de 8 caractères', async () => {
      const res = await register({
        role: 'COMPANY',
        fullName: 'Recruteur',
        email: email('sans-nom'),
        password: 'court',
      }).expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'Le nom de l’entreprise est obligatoire.',
          'Le mot de passe doit contenir entre 8 et 128 caractères.',
        ]),
      );
    });

    it('refuse un e-mail déjà utilisé, même écrit en majuscules', async () => {
      await registerCandidate('doublon');
      const res = await register({
        role: 'CANDIDATE',
        fullName: 'Autre',
        email: `  ${email('doublon').toUpperCase()} `,
        password: PASSWORD,
      }).expect(409);
      expect(res.body.message).toBe(
        'Un compte existe déjà avec cette adresse e-mail.',
      );
    });
  });

  describe('Connexion', () => {
    beforeAll(async () => {
      await registerCandidate('login');
    });

    it('connecte avec des identifiants valides (e-mail insensible à la casse)', async () => {
      const res = await http()
        .post('/api/auth/login')
        .set(CSRF)
        .send({ email: ` ${email('login').toUpperCase()}`, password: PASSWORD })
        .expect(200);
      expect(res.body.user.email).toBe(email('login'));
      expect(refreshCookie(res).value).not.toBe('');
    });

    it('« Se souvenir de moi » : cookie persistant de 30 jours', async () => {
      const res = await login('login', { rememberMe: true }).expect(200);
      const expires = /Expires=([^;]+)/i.exec(refreshCookie(res).raw)?.[1];
      const days =
        (new Date(expires as string).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
      const session = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(refreshCookie(res).value) },
      });
      expect(session.persistent).toBe(true);
    });

    it.each([
      ['mauvais mot de passe', email('login'), 'Mauvais-mot-de-passe'],
      ['e-mail inconnu', email('inconnu'), PASSWORD],
      [
        'compte de démonstration sans mot de passe',
        'mariama.diallo@proavenir.test',
        PASSWORD,
      ],
    ])(
      'refuse avec un message identique : %s',
      async (_cas, mail, password) => {
        const res = await http()
          .post('/api/auth/login')
          .set(CSRF)
          .send({ email: mail, password })
          .expect(401);
        expect(res.body.message).toBe(INVALID_CREDENTIALS);
        expect(res.headers['set-cookie']).toBeUndefined();
      },
    );

    it('refuse un compte désactivé, même avec le bon mot de passe', async () => {
      await registerCandidate('inactif');
      await prisma.user.update({
        where: { email: email('inactif') },
        data: { isActive: false },
      });
      const res = await login('inactif').expect(401);
      expect(res.body.message).toBe(INVALID_CREDENTIALS);
    });

    it('limite les tentatives : la 6e en une minute renvoie 429', async () => {
      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/auth/login')
          .set(CSRF)
          .send({ email: email('login'), password: 'Mauvais-mot-de-passe' })
          .expect(401);
      }
      const res = await login('login').expect(429);
      expect(res.body.message).toMatch(/Trop de tentatives/);
    });
  });

  describe('Protection CSRF des routes à cookie', () => {
    it('refuse une requête sans l’en-tête X-ProAvenir-CSRF', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: email('login'), password: PASSWORD })
        .expect(403);
    });

    it('refuse une requête venant d’un site non autorisé', async () => {
      await http()
        .post('/api/auth/logout')
        .set(CSRF)
        .set('Origin', 'https://site-malveillant.example')
        .expect(403);
    });

    it('accepte le frontend déclaré dans CORS_ORIGIN', async () => {
      await http()
        .post('/api/auth/logout')
        .set(CSRF)
        .set('Origin', 'http://localhost:8443')
        .expect(204);
    });
  });

  describe('Jeton d’accès et GET /api/auth/me', () => {
    it('renvoie l’utilisateur connecté', async () => {
      const { body } = await registerCandidate('me');
      const res = await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(res.body).toEqual({
        id: body.user.id,
        email: email('me'),
        fullName: 'Candidat E2E',
        role: 'CANDIDATE',
        company: null,
      });
    });

    it.each([
      ['sans jeton', undefined],
      ['jeton illisible', 'Bearer pas-un-jwt'],
      ['mauvais schéma', 'Basic abc'],
    ])('refuse : %s (401)', async (_cas, header) => {
      const req = http().get('/api/auth/me');
      if (header) req.set('Authorization', header);
      await req.expect(401);
    });

    it('refuse un jeton signé avec un autre secret ou sans signature', async () => {
      const { body } = await registerCandidate('faux-jeton');
      const forged = new JwtService({
        secret: 'un-autre-secret-de-32-caracteres!!',
      }).sign({ sub: body.user.id, role: 'ADMIN' });
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);

      const unsigned = [
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
          'base64url',
        ),
        Buffer.from(
          JSON.stringify({ sub: body.user.id, role: 'ADMIN' }),
        ).toString('base64url'),
        '',
      ].join('.');
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${unsigned}`)
        .expect(401);
    });

    it('un compte désactivé perd l’accès immédiatement', async () => {
      const { body } = await registerCandidate('desactive');
      await prisma.user.update({
        where: { id: body.user.id },
        data: { isActive: false },
      });
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(401);
    });

    it('les routes publiques restent accessibles sans connexion', async () => {
      await http().get('/api/offers').expect(200);
      await http().get('/api/cities').expect(200);
      await http().get('/api/health').expect(200);
    });
  });

  describe('Renouvellement (rotation) et révocation', () => {
    it('remplace le jeton, conserve la fin de session et le type de cookie', async () => {
      const first = refreshCookie(
        await login('login', { rememberMe: true }).expect(200),
      );
      // (le compte « login » a été créé dans le bloc Connexion)
      const before = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(first.value) },
      });

      const res = await refresh(first.header).expect(200);
      expect(typeof res.body.accessToken).toBe('string');
      const second = refreshCookie(res);
      expect(second.value).not.toBe(first.value);
      expect(second.raw).toMatch(/Expires=/i); // toujours persistant

      const old = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(first.value) },
      });
      const next = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(second.value) },
      });
      expect(old.revokedAt).not.toBeNull();
      expect(next.revokedAt).toBeNull();
      expect(next.expiresAt).toEqual(before.expiresAt); // fin de session absolue
      expect(next.persistent).toBe(true);
    });

    it('une session sans « Se souvenir de moi » reste un cookie de session', async () => {
      const first = refreshCookie(await login('login').expect(200));
      const res = await refresh(first.header).expect(200);
      expect(refreshCookie(res).raw).not.toMatch(/Expires=/i);
    });

    it('deux renouvellements simultanés : un seul réussit, sans déconnecter le compte', async () => {
      const cookie = refreshCookie(await login('login').expect(200));
      const results = await Promise.all([
        refresh(cookie.header),
        refresh(cookie.header),
      ]);
      const statuses = results.map((r) => r.status).sort((a, b) => a - b);
      expect(statuses).toEqual([200, 401]);
      const loser = results.find((r) => r.status === 401) as request.Response;
      expect(loser.body.code).toBe('SESSION_ROTATED');
      expect(loser.headers['set-cookie']).toBeUndefined(); // le bon cookie n'est pas effacé
      const winner = results.find((r) => r.status === 200) as request.Response;
      await refresh(refreshCookie(winner).header).expect(200);
    });

    it('réutiliser un ancien jeton (vol probable) révoque toutes les sessions du compte', async () => {
      await registerCandidate('vol');
      const stolen = refreshCookie(await login('vol').expect(200));
      const current = refreshCookie(await refresh(stolen.header).expect(200));
      // Le jeton volé a été remplacé il y a plus de 30 secondes.
      await prisma.refreshToken.update({
        where: { tokenHash: hashRefreshToken(stolen.value) },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });

      const res = await refresh(stolen.header).expect(401);
      expect(refreshCookie(res).raw).toMatch(/Expires=Thu, 01 Jan 1970/); // cookie effacé
      // Même la session légitime est fermée : l'utilisateur doit se reconnecter.
      await refresh(current.header).expect(401);
      expect(
        await prisma.refreshToken.count({
          where: { user: { email: email('vol') }, revokedAt: null },
        }),
      ).toBe(0);
    });

    it('refuse une session expirée', async () => {
      await registerCandidate('expire');
      const cookie = refreshCookie(await login('expire').expect(200));
      await prisma.refreshToken.update({
        where: { tokenHash: hashRefreshToken(cookie.value) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refresh(cookie.header).expect(401);
    });

    it('refuse sans cookie ou avec un cookie inventé', async () => {
      await http().post('/api/auth/refresh').set(CSRF).expect(401);
      await refresh('proavenir_refresh=invente').expect(401);
    });
  });

  describe('Déconnexion', () => {
    it('révoque la session, efface le cookie et empêche tout renouvellement', async () => {
      await registerCandidate('logout');
      const cookie = refreshCookie(await login('logout').expect(200));
      const res = await http()
        .post('/api/auth/logout')
        .set(CSRF)
        .set('Cookie', cookie.header)
        .expect(204);
      expect(refreshCookie(res).raw).toMatch(/Expires=Thu, 01 Jan 1970/);
      const session = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(cookie.value) },
      });
      expect(session.revokedAt).not.toBeNull();
      await refresh(cookie.header).expect(401);
    });

    it('fonctionne aussi sans session (aucune erreur)', async () => {
      await http().post('/api/auth/logout').set(CSRF).expect(204);
    });
  });
});
