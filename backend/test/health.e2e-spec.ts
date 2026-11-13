/**
 * Test de bout en bout : démarre la vraie application avec la vraie base
 * PostgreSQL (conteneur Docker). Prérequis : `docker compose up -d`.
 * Lancement : npm run test:e2e
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('API ProAvenir (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health répond 200 et confirme la connexion à PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(new Date(response.body.timestamp).toString()).not.toBe(
      'Invalid Date',
    );
  });

  it('les routes sont préfixées par /api', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('CORS autorise le frontend déclaré dans CORS_ORIGIN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:8443');
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8443',
    );
  });

  it("CORS n'autorise pas une origine inconnue", async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://site-malveillant.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
