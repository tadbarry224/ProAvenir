/**
 * Tests de bout en bout des API publiques : GET /api/cities, /api/domains, /api/offers.
 * Ils démarrent la vraie application sur la vraie base (données de départ).
 * Prérequis : `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`.
 *
 * La date du jour est simulée (ClockService remplacé) pour tester l'expiration.
 * Les cas « brouillon / clôturée / expirée / entreprise refusée » utilisent des
 * lignes de TEST à identifiants fixes (préfixe 9…), créées ici puis retirées :
 * les données de départ ne sont jamais modifiées.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ClockService } from '../src/common/clock.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type {
  PublicOffer,
  PublicOffersResponse,
} from '../src/offers/public-offer.js';

const testId = (n: number) =>
  `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEST_COMPANY = testId(1);
const REJECTED_COMPANY = testId(2);
const TEST_OFFER_IDS = [11, 12, 13, 14, 15].map(testId);

/** Date du jour simulée, modifiable par chaque test. */
let today = '2026-11-13';

describe('API publiques (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const listOffers = async (query = '') => {
    const response = await http().get(`/api/offers${query}`).expect(200);
    return response.body as PublicOffersResponse;
  };
  const titles = (body: PublicOffersResponse) => body.data.map((o) => o.title);

  /** Supprime UNIQUEMENT les lignes créées par ce fichier de test. */
  const removeTestRows = async () => {
    await prisma.offer.deleteMany({ where: { id: { in: TEST_OFFER_IDS } } });
    await prisma.company.deleteMany({
      where: { id: { in: [TEST_COMPANY, REJECTED_COMPANY] } },
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClockService)
      .useValue({ today: () => today })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await removeTestRows(); // restes éventuels d'une exécution interrompue
  });

  afterAll(async () => {
    await removeTestRows();
    await app.close();
  });

  beforeEach(() => {
    today = '2026-11-13';
  });

  describe('GET /api/cities et /api/domains', () => {
    it('renvoie les 4 villes, triées, avec seulement id et name', async () => {
      const { body } = await http().get('/api/cities').expect(200);
      expect(body).toEqual({
        data: [
          { id: 'boke', name: 'Boké' },
          { id: 'conakry', name: 'Conakry' },
          { id: 'kindia', name: 'Kindia' },
          { id: 'labe', name: 'Labé' },
        ],
      });
    });

    it('renvoie les 6 domaines, triés', async () => {
      const { body } = await http().get('/api/domains').expect(200);
      expect(body.data.map((d: { id: string }) => d.id)).toEqual([
        'commerce',
        'finance',
        'informatique',
        'logistique',
        'marketing',
        'ressources-humaines',
      ]);
    });
  });

  describe('GET /api/offers', () => {
    it('renvoie les 6 offres publiques, les plus récentes d’abord', async () => {
      const body = await listOffers();
      expect(body.meta).toEqual({ total: 6, today: '2026-11-13' });
      expect(titles(body)).toEqual([
        'Assistant·e marketing digital',
        'Développeur·se web junior',
        'Chargé·e de clientèle',
        'Stagiaire comptable',
        'Assistant·e ressources humaines',
        'Agent·e logistique',
      ]);
    });

    it("n'expose que les champs publics (aucune donnée sensible)", async () => {
      const [offer] = (await listOffers()).data;
      expect(Object.keys(offer).sort()).toEqual(
        [
          'city',
          'company',
          'contractType',
          'deadline',
          'description',
          'domain',
          'duration',
          'featured',
          'id',
          'publishedAt',
          'skills',
          'title',
          'type',
          'workSchedule',
        ].sort(),
      );
      expect(Object.keys(offer.company).sort()).toEqual(['logoColor', 'name']);
      expect(JSON.stringify(offer)).not.toMatch(
        /email|password|phone|status|companyId/i,
      );
    });

    it('renvoie les dates, types de contrat et durées attendus', async () => {
      const byTitle = new Map(
        (await listOffers()).data.map((o) => [o.title, o]),
      );
      expect(byTitle.get('Développeur·se web junior')).toMatchObject({
        type: 'JOB',
        contractType: 'CDI',
        workSchedule: 'FULL_TIME',
        duration: null,
        deadline: '2027-01-04',
        publishedAt: '2026-12-07T12:00:00.000Z',
        city: { id: 'conakry', name: 'Conakry' },
        domain: { id: 'informatique', name: 'Informatique' },
        company: { name: 'Nimba Digital', logoColor: 'green' },
      } satisfies Partial<PublicOffer>);
      expect(byTitle.get('Stagiaire comptable')).toMatchObject({
        type: 'INTERNSHIP',
        contractType: 'INTERNSHIP',
        workSchedule: null,
        duration: '3 mois',
        deadline: '2027-01-15',
      });
      expect(byTitle.get('Chargé·e de clientèle')).toMatchObject({
        contractType: 'CDD',
        duration: '12 mois',
      });
    });

    it('filtre par ville, domaine et type', async () => {
      expect(titles(await listOffers('?city=boke'))).toEqual([
        'Agent·e logistique',
      ]);
      expect(titles(await listOffers('?domain=finance'))).toEqual([
        'Stagiaire comptable',
      ]);
      expect(titles(await listOffers('?type=INTERNSHIP'))).toEqual([
        'Assistant·e marketing digital',
        'Stagiaire comptable',
      ]);
      expect((await listOffers('?type=JOB')).meta.total).toBe(4);
    });

    it('recherche dans l’intitulé, l’entreprise et les compétences, sans tenir compte des majuscules', async () => {
      expect(titles(await listOffers('?q=WEB'))).toEqual([
        'Développeur·se web junior',
      ]);
      expect(titles(await listOffers('?q=nimba'))).toEqual([
        'Développeur·se web junior',
      ]);
      // « Excel » est une compétence, absente des intitulés.
      expect(titles(await listOffers('?q=excel')).length).toBeGreaterThan(0);
      for (const offer of (await listOffers('?q=excel')).data) {
        expect(
          `${offer.title} ${offer.company.name} ${offer.skills.join(' ')}`,
        ).toMatch(/excel/i);
      }
      // Les espaces autour de la recherche sont ignorés.
      expect(titles(await listOffers('?q=%20%20nimba%20'))).toEqual([
        'Développeur·se web junior',
      ]);
    });

    it('combine les filtres', async () => {
      expect(
        titles(await listOffers('?city=conakry&domain=informatique&q=web')),
      ).toEqual(['Développeur·se web junior']);
      expect(
        (await listOffers('?city=conakry&type=INTERNSHIP')).data.every(
          (o) => o.city.id === 'conakry' && o.type === 'INTERNSHIP',
        ),
      ).toBe(true);
      // Aucune correspondance : liste vide, pas une erreur.
      expect(await listOffers('?city=boke&type=INTERNSHIP')).toEqual({
        data: [],
        meta: { total: 0, today: '2026-11-13' },
      });
    });

    it('traite % et _ comme du texte, pas comme des jokers', async () => {
      expect((await listOffers('?q=%25')).meta.total).toBe(0);
      expect((await listOffers('?q=_')).meta.total).toBe(0);
    });

    it('une ville inconnue mais bien formée donne une liste vide', async () => {
      expect((await listOffers('?city=mamou')).meta.total).toBe(0);
    });

    it.each([
      ['type inconnu', '?type=FREELANCE'],
      ['ville mal formée', '?city=Conakry!'],
      ['paramètre non prévu', '?status=DRAFT'],
      ['filtre répété', '?city=boke&city=labe'],
      ['recherche trop longue', `?q=${'a'.repeat(101)}`],
    ])(
      'refuse les paramètres invalides (%s) avec 400',
      async (_case, query) => {
        const { body } = await http().get(`/api/offers${query}`).expect(400);
        expect(body.statusCode).toBe(400);
      },
    );
  });

  describe('Visibilité selon la date limite', () => {
    it('une offre reste visible le jour de sa date limite, puis disparaît', async () => {
      today = '2027-01-20'; // date limite de « Agent·e logistique »
      expect(titles(await listOffers())).toEqual(['Agent·e logistique']);
      today = '2027-01-21';
      expect((await listOffers()).meta.total).toBe(0);
    });

    it('au 11 janv. 2027, seules 3 offres restent ouvertes', async () => {
      today = '2027-01-11';
      expect((await listOffers()).meta.total).toBe(3);
    });
  });

  describe('Offres jamais publiques', () => {
    beforeAll(async () => {
      await prisma.company.createMany({
        data: [
          {
            id: TEST_COMPANY,
            name: '[e2e] Entreprise validée',
            status: 'APPROVED',
          },
          {
            id: REJECTED_COMPANY,
            name: '[e2e] Entreprise refusée',
            status: 'REJECTED',
            rejectionReason: 'Test automatique',
          },
        ],
      });
      const base = {
        companyId: TEST_COMPANY,
        type: 'JOB' as const,
        cityId: 'conakry',
        domainId: 'commerce',
        description: 'Offre de test automatique.',
        publishedAt: new Date('2026-11-01T12:00:00Z'),
      };
      await prisma.offer.createMany({
        data: [
          {
            ...base,
            id: TEST_OFFER_IDS[0],
            title: '[e2e] Visible aujourd’hui',
            status: 'PUBLISHED',
            deadline: new Date('2026-11-13'),
          },
          {
            ...base,
            id: TEST_OFFER_IDS[1],
            title: '[e2e] Brouillon',
            status: 'DRAFT',
            deadline: new Date('2027-06-30'),
            publishedAt: null,
          },
          {
            ...base,
            id: TEST_OFFER_IDS[2],
            title: '[e2e] Clôturée',
            status: 'CLOSED',
            deadline: new Date('2027-06-30'),
            closedAt: new Date(),
          },
          {
            ...base,
            id: TEST_OFFER_IDS[3],
            title: '[e2e] Expirée hier',
            status: 'PUBLISHED',
            deadline: new Date('2026-11-12'),
          },
          {
            ...base,
            id: TEST_OFFER_IDS[4],
            companyId: REJECTED_COMPANY,
            title: '[e2e] Entreprise refusée',
            status: 'PUBLISHED',
            deadline: new Date('2027-06-30'),
          },
        ],
      });
    });

    it('ni brouillon, ni clôturée, ni expirée, ni entreprise non validée', async () => {
      const all = await listOffers();
      expect(all.meta.total).toBe(7); // 6 offres de départ + la visible du jour
      const testTitles = titles(all).filter((t) => t.startsWith('[e2e]'));
      expect(testTitles).toEqual(['[e2e] Visible aujourd’hui']);

      // Même en les cherchant explicitement.
      expect(titles(await listOffers('?q=e2e'))).toEqual([
        '[e2e] Visible aujourd’hui',
      ]);
    });
  });
});
