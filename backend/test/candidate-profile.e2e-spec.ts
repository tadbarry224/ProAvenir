/**
 * Tests de bout en bout du profil candidat et du CV (B6), sur la vraie base :
 *   GET|PATCH /api/candidates/me/profile, PUT|GET|DELETE /api/candidates/me/cv,
 *   GET /api/companies/me/applications/:id/cv
 *
 * Données de TEST uniquement : identifiants « 97000000-… », e-mails
 * « e2e-b6-…@proavenir.test », entreprises et offres « [e2e-b6] … », retirées à la fin.
 * Les fichiers sont écrits dans un dossier TEMPORAIRE (CvStorage remplacé) : rien
 * n'est ajouté dans storage/cvs.
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { CandidateProfileResponse } from '../src/candidate-profile/candidate-profile.service.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CvStorage } from '../src/storage/cv-storage.service.js';

const id = (n: number) =>
  `97000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const email = (name: string) => `e2e-b6-${name}@proavenir.test`;

const COMPANY = { A: id(1), B: id(2) };
const USER = { candidate: id(11), ownerA: id(12), ownerB: id(13) };
const PROFILE = id(21);
const OFFER = id(31);

const pdf = (text: string) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);

describe('Profil candidat et CV (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let storageDir: string;

  const http = () => request(app.getHttpServer());
  const bearer = (userId: string, role: UserRole) =>
    `Bearer ${jwt.sign({ sub: userId, role })}`;
  const asCandidate = () => bearer(USER.candidate, 'CANDIDATE');
  const uploadCv = (content: Buffer, filename = 'Mon CV.pdf') =>
    http()
      .put('/api/candidates/me/cv')
      .set('Authorization', asCandidate())
      .attach('cv', content, { filename, contentType: 'application/pdf' });
  const storedFiles = async () => {
    try {
      return await readdir(storageDir);
    } catch {
      return [];
    }
  };

  const removeTestRows = async () => {
    await prisma.application.deleteMany({ where: { offerId: OFFER } });
    await prisma.offer.deleteMany({ where: { id: OFFER } });
    await prisma.company.deleteMany({
      where: { id: { in: Object.values(COMPANY) } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-b6-' } },
    });
  };

  const seedTestRows = async () => {
    await prisma.company.createMany({
      data: [
        { id: COMPANY.A, name: '[e2e-b6] Entreprise A', status: 'APPROVED' },
        { id: COMPANY.B, name: '[e2e-b6] Entreprise B', status: 'APPROVED' },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: USER.candidate,
          email: email('candidate'),
          fullName: 'E2E Candidat',
          role: 'CANDIDATE',
        },
        {
          id: USER.ownerA,
          email: email('owner-a'),
          fullName: 'E2E A',
          role: 'COMPANY',
        },
        {
          id: USER.ownerB,
          email: email('owner-b'),
          fullName: 'E2E B',
          role: 'COMPANY',
        },
      ],
    });
    await prisma.companyMember.createMany({
      data: [
        { companyId: COMPANY.A, userId: USER.ownerA },
        { companyId: COMPANY.B, userId: USER.ownerB },
      ],
    });
    await prisma.candidateProfile.create({
      data: { id: PROFILE, userId: USER.candidate },
    });
    await prisma.offer.create({
      data: {
        id: OFFER,
        companyId: COMPANY.A,
        title: '[e2e-b6] Offre',
        type: 'JOB',
        cityId: 'conakry',
        domainId: 'commerce',
        description: 'Offre de test automatique pour le dépôt de CV.',
        status: 'PUBLISHED',
        deadline: new Date('2099-12-31'),
        publishedAt: new Date('2026-11-01T12:00:00Z'),
      },
    });
  };

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'proavenir-e2e-cv-'));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CvStorage)
      .useValue(new CvStorage(storageDir))
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await removeTestRows();
  });

  beforeEach(async () => {
    await removeTestRows();
    await rm(storageDir, { recursive: true, force: true });
    await seedTestRows();
  });

  afterAll(async () => {
    await removeTestRows();
    await rm(storageDir, { recursive: true, force: true });
    await app.close();
  });

  describe('Accès', () => {
    it('réservé au candidat connecté (401 sans jeton, 403 pour une entreprise)', async () => {
      await http().get('/api/candidates/me/profile').expect(401);
      await http().put('/api/candidates/me/cv').expect(401);
      await http()
        .get('/api/candidates/me/profile')
        .set('Authorization', bearer(USER.ownerA, 'COMPANY'))
        .expect(403);
    });
  });

  describe('Profil', () => {
    it('renvoie le profil, sans clé de fichier ni donnée interne', async () => {
      const res = await http()
        .get('/api/candidates/me/profile')
        .set('Authorization', asCandidate())
        .expect(200);
      expect(res.body).toEqual({
        fullName: 'E2E Candidat',
        email: email('candidate'),
        city: null,
        education: null,
        bio: null,
        skills: [],
        cv: null,
      });
    });

    it('enregistre les champs envoyés, y compris le nom du compte', async () => {
      const res = await http()
        .patch('/api/candidates/me/profile')
        .set('Authorization', asCandidate())
        .send({
          fullName: ' Aïssatou  Bah ',
          cityId: 'kindia',
          education: 'BTS Comptabilité',
          bio: 'Motivée et rigoureuse.',
          skills: ['Excel', 'excel', 'Sage'],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        fullName: 'Aïssatou Bah',
        city: { id: 'kindia', name: 'Kindia' },
        education: 'BTS Comptabilité',
        skills: ['Excel', 'Sage'],
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: USER.candidate },
      });
      expect(user.fullName).toBe('Aïssatou Bah');

      // Un texte vide efface la valeur ; les autres champs ne bougent pas.
      const cleared = await http()
        .patch('/api/candidates/me/profile')
        .set('Authorization', asCandidate())
        .send({ cityId: '', education: '' })
        .expect(200);
      expect(cleared.body).toMatchObject({
        city: null,
        education: null,
        bio: 'Motivée et rigoureuse.',
      });
    });

    it('refuse une ville inconnue et les champs non prévus (400)', async () => {
      const city = await http()
        .patch('/api/candidates/me/profile')
        .set('Authorization', asCandidate())
        .send({ cityId: 'paris' })
        .expect(400);
      expect(city.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [
          { field: 'cityId', message: 'Choisissez une ville dans la liste.' },
        ],
      });
      await http()
        .patch('/api/candidates/me/profile')
        .set('Authorization', asCandidate())
        .send({ email: 'pirate@exemple.gn' })
        .expect(400);
    });
  });

  describe('CV', () => {
    it('dépose un PDF, puis le télécharge avec des en-têtes sûrs', async () => {
      const content = pdf('premier CV');
      const res = await uploadCv(content, 'CV Aïssatou.pdf').expect(200);
      const profile = res.body as CandidateProfileResponse;
      expect(profile.cv).toMatchObject({
        fileName: 'CV Aïssatou.pdf',
        size: content.length,
      });
      expect(await storedFiles()).toHaveLength(1);

      const download = await http()
        .get('/api/candidates/me/cv')
        .set('Authorization', asCandidate())
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(download.headers['content-type']).toBe('application/pdf');
      expect(download.headers['x-content-type-options']).toBe('nosniff');
      expect(download.headers['cache-control']).toBe('no-store');
      expect(download.headers['content-disposition']).toContain(
        'attachment; filename="CV A_ssatou.pdf"; filename*=UTF-8\'\'CV%20A%C3%AFssatou.pdf',
      );
      expect(download.body).toEqual(content);
    });

    it('refuse un envoi vide, un faux PDF et un fichier de plus de 5 Mo', async () => {
      const empty = await http()
        .put('/api/candidates/me/cv')
        .set('Authorization', asCandidate())
        .expect(400);
      expect(empty.body.code).toBe('CV_REQUIRED');

      const fake = await uploadCv(Buffer.from('MZ programme'), 'cv.pdf').expect(
        400,
      );
      expect(fake.body).toMatchObject({
        code: 'CV_NOT_PDF',
        message: 'Le CV doit être un fichier PDF.',
      });

      const big = Buffer.concat([pdf(''), Buffer.alloc(5 * 1024 * 1024, 0x20)]);
      const tooLarge = await uploadCv(big).expect(413);
      expect(tooLarge.body).toMatchObject({
        code: 'CV_TOO_LARGE',
        message: 'Le CV ne doit pas dépasser 5 Mo.',
      });
      expect(await storedFiles()).toHaveLength(0);
    });

    it('remplacer le CV supprime l’ancien fichier s’il n’a été envoyé à personne', async () => {
      await uploadCv(pdf('v1')).expect(200);
      const [first] = await storedFiles();
      await uploadCv(pdf('v2')).expect(200);
      const files = await storedFiles();
      expect(files).toHaveLength(1);
      expect(files[0]).not.toBe(first);
    });

    it('le CV joint à une candidature reste téléchargeable par l’entreprise, même remplacé ou supprimé', async () => {
      await uploadCv(pdf('CV envoyé'), 'CV envoyé.pdf').expect(200);
      const applied = await http()
        .post('/api/candidates/me/applications')
        .set('Authorization', asCandidate())
        .send({ offerId: OFFER })
        .expect(201);
      const applicationId = applied.body.id as string;

      // Le candidat remplace puis supprime son CV : l'ancien fichier est conservé.
      await uploadCv(pdf('nouveau CV')).expect(200);
      await http()
        .delete('/api/candidates/me/cv')
        .set('Authorization', asCandidate())
        .expect(200);
      expect(await storedFiles()).toHaveLength(1);

      const received = await http()
        .get('/api/companies/me/applications')
        .set('Authorization', bearer(USER.ownerA, 'COMPANY'))
        .expect(200);
      expect(received.body.data[0].cvFileName).toBe('CV envoyé.pdf');
      expect(JSON.stringify(received.body)).not.toMatch(/cvFileKey/);

      const download = await http()
        .get(`/api/companies/me/applications/${applicationId}/cv`)
        .set('Authorization', bearer(USER.ownerA, 'COMPANY'))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(download.body).toEqual(pdf('CV envoyé'));

      // Une autre entreprise ne peut pas le télécharger.
      const other = await http()
        .get(`/api/companies/me/applications/${applicationId}/cv`)
        .set('Authorization', bearer(USER.ownerB, 'COMPANY'))
        .expect(404);
      expect(other.body.code).toBe('APPLICATION_NOT_FOUND');
    });

    it('candidature sans CV : 404 CV_NOT_FOUND ; profil sans CV : 404', async () => {
      const applied = await http()
        .post('/api/candidates/me/applications')
        .set('Authorization', asCandidate())
        .send({ offerId: OFFER })
        .expect(201);
      const res = await http()
        .get(`/api/companies/me/applications/${applied.body.id}/cv`)
        .set('Authorization', bearer(USER.ownerA, 'COMPANY'))
        .expect(404);
      expect(res.body.code).toBe('CV_NOT_FOUND');
      await http()
        .get('/api/candidates/me/cv')
        .set('Authorization', asCandidate())
        .expect(404);
    });
  });
});
