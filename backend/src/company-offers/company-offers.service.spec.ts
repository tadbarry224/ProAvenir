import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ClockService } from '../common/clock.service.js';
import type { CompanyStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CompanyMembershipService } from './company-membership.service.js';
import {
  CompanyOffersService,
  OFFER_NOT_FOUND,
} from './company-offers.service.js';
import type { CreateCompanyOfferDto } from './dto/create-company-offer.dto.js';
import { PERMISSION_MESSAGES } from './offer-rules.js';

/** Tests unitaires de la création : base simulée, aucun PostgreSQL nécessaire. */
const TODAY = '2026-11-20';
const COMPANY_ID = 'company-from-session';

/** Corps reçu, vu comme un simple objet (même forme que le DTO, sans la classe). */
type OfferBody = {
  [K in keyof CreateCompanyOfferDto]: CreateCompanyOfferDto[K];
};

const draft: OfferBody = {
  status: 'DRAFT',
  title: 'Assistant marketing',
  type: 'JOB',
  cityId: 'conakry',
  domainId: 'marketing',
};
const publishable: OfferBody = {
  ...draft,
  status: 'PUBLISHED',
  description: 'x'.repeat(60),
  deadline: '2026-12-31',
};

/** Ligne renvoyée par offer.create (forme de companyOfferSelect). */
const createdRow = (data: Record<string, unknown>) => ({
  id: 'new-offer',
  title: data.title,
  type: data.type,
  contractType: null,
  workSchedule: null,
  duration: null,
  status: data.status,
  description: data.description,
  deadline: data.deadline,
  skills: data.skills,
  featured: false,
  publishedAt: data.publishedAt,
  closedAt: null,
  createdAt: new Date('2026-11-20T10:00:00Z'),
  updatedAt: new Date('2026-11-20T10:00:00Z'),
  city: { id: 'conakry', name: 'Conakry' },
  domain: { id: 'marketing', name: 'Marketing' },
  _count: { applications: 0 },
});

function setup(
  companyStatus: CompanyStatus,
  refs = { city: true, domain: true },
) {
  const create = vi.fn(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve(createdRow(data)),
  );
  const tx = {
    city: {
      findUnique: vi.fn().mockResolvedValue(refs.city ? { id: 'c' } : null),
    },
    domain: {
      findUnique: vi.fn().mockResolvedValue(refs.domain ? { id: 'd' } : null),
    },
    offer: { create },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const lockCurrentCompany = vi.fn().mockResolvedValue({
    id: COMPANY_ID,
    name: 'Entreprise',
    status: companyStatus,
  });
  const service = new CompanyOffersService(
    prisma as unknown as PrismaService,
    { today: () => TODAY } as ClockService,
    { lockCurrentCompany } as unknown as CompanyMembershipService,
  );
  return { service, create, lockCurrentCompany };
}

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('une erreur était attendue');
    },
    (error: unknown) => error,
  );

describe('CompanyOffersService.create', () => {
  it('crée un brouillon pour l’entreprise de la session, sans date de publication', async () => {
    const { service, create, lockCurrentCompany } = setup('APPROVED');
    const offer = await service.create('user-1', draft);

    expect(lockCurrentCompany).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
    );
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      companyId: COMPANY_ID,
      status: 'DRAFT',
      description: '',
      deadline: null,
      skills: [],
      publishedAt: null,
    });
    expect(data).not.toHaveProperty('featured');
    expect(offer).toMatchObject({ status: 'DRAFT', publiclyVisible: false });
  });

  it('publie directement pour une entreprise validée (date de publication fixée par le serveur)', async () => {
    const { service, create } = setup('APPROVED');
    const offer = await service.create('user-1', publishable);
    const data = create.mock.calls[0][0].data;
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.deadline).toEqual(new Date('2026-12-31'));
    expect(offer).toMatchObject({
      status: 'PUBLISHED',
      deadline: '2026-12-31',
      publiclyVisible: true,
    });
  });

  it('entreprise en attente : brouillon accepté, publication refusée (403)', async () => {
    const pending = setup('PENDING');
    await expect(pending.service.create('u', draft)).resolves.toMatchObject({
      status: 'DRAFT',
    });

    const refused = setup('PENDING');
    const error = await errorOf(refused.service.create('u', publishable));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as Error).message).toBe(PERMISSION_MESSAGES.pendingPublish);
    expect(refused.create).not.toHaveBeenCalled();
  });

  it.each([draft, publishable])(
    'entreprise refusée : aucune création (403, statut $status)',
    async (dto) => {
      const { service, create } = setup('REJECTED');
      const error = await errorOf(service.create('u', dto));
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as Error).message).toBe(PERMISSION_MESSAGES.rejected);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('regroupe toutes les erreurs de données dans un seul 400, sans rien créer', async () => {
    const { service, create } = setup('APPROVED', {
      city: false,
      domain: false,
    });
    const error = await errorOf(
      service.create('u', {
        ...publishable,
        type: 'INTERNSHIP',
        contractType: 'CDI',
        description: 'trop court',
        deadline: '2026-11-19',
      }),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    const { message } = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    expect(message).toEqual([
      'Choisissez une ville dans la liste.',
      'Choisissez un domaine dans la liste.',
      'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
      'La description doit contenir au moins 50 caractères pour publier (actuellement 10).',
      'La date limite ne peut pas être dans le passé.',
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('un brouillon peut rester incomplet (date passée, description courte)', async () => {
    const { service, create } = setup('APPROVED');
    await service.create('u', {
      ...draft,
      description: 'court',
      deadline: '2026-01-01',
    });
    expect(create).toHaveBeenCalledOnce();
  });
});

describe('CompanyOffersService.changeStatus', () => {
  type StoredOffer = {
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
    description: string;
    deadline: Date | null;
    publishedAt: Date | null;
  };
  const complete: StoredOffer = {
    status: 'DRAFT',
    description: 'x'.repeat(60),
    deadline: new Date('2026-12-31'),
    publishedAt: null,
  };

  /** offer = null : aucune offre de CETTE entreprise ne correspond (verrou vide). */
  function setupStatus(
    companyStatus: CompanyStatus,
    offer: StoredOffer | null,
  ) {
    const update = vi.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(
        createdRow({
          ...offer,
          ...data,
          title: 'Offre',
          type: 'JOB',
          skills: [],
        }),
      ),
    );
    const queryRaw = vi.fn().mockResolvedValue(offer ? [{ id: 'o-1' }] : []);
    const tx = {
      $queryRaw: queryRaw,
      offer: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(offer),
        update,
      },
    };
    const prisma = {
      $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new CompanyOffersService(
      prisma as unknown as PrismaService,
      { today: () => TODAY } as ClockService,
      {
        lockCurrentCompany: vi.fn().mockResolvedValue({
          id: COMPANY_ID,
          name: 'Entreprise',
          status: companyStatus,
        }),
      } as unknown as CompanyMembershipService,
    );
    return { service, update, queryRaw };
  }

  it('cherche l’offre avec l’identifiant ET l’entreprise de la session, en la verrouillant', async () => {
    const { service, queryRaw } = setupStatus('APPROVED', complete);
    await service.changeStatus('u', 'o-1', 'PUBLISHED');
    const [sqlParts, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(values).toEqual(['o-1', COMPANY_ID]);
    expect(sqlParts.join('?')).toMatch(/FOR UPDATE/);
  });

  it('offre absente ou d’une autre entreprise : 404, aucune modification', async () => {
    const { service, update } = setupStatus('APPROVED', null);
    const error = await errorOf(service.changeStatus('u', 'o-1', 'CLOSED'));
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as Error).message).toBe(OFFER_NOT_FOUND);
    expect(update).not.toHaveBeenCalled();
  });

  it('publie un brouillon complet : publishedAt fixé, closedAt effacé', async () => {
    const { service, update } = setupStatus('APPROVED', complete);
    const offer = await service.changeStatus('u', 'o-1', 'PUBLISHED');
    const data = update.mock.calls[0][0].data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.closedAt).toBeNull();
    expect(offer.publiclyVisible).toBe(true);
  });

  it('rouvre une offre clôturée en conservant sa première date de publication', async () => {
    const first = new Date('2026-11-01T12:00:00Z');
    const { service, update } = setupStatus('APPROVED', {
      ...complete,
      status: 'CLOSED',
      publishedAt: first,
    });
    await service.changeStatus('u', 'o-1', 'PUBLISHED');
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: first,
      closedAt: null,
    });
  });

  it('clôture une offre expirée (date limite passée)', async () => {
    const { service, update } = setupStatus('APPROVED', {
      ...complete,
      status: 'PUBLISHED',
      deadline: new Date('2026-11-01'),
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    });
    await service.changeStatus('u', 'o-1', 'CLOSED');
    expect(update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it.each([
    ['date limite passée', { deadline: new Date('2026-11-19') }],
    ['sans date limite', { deadline: null }],
    ['description trop courte', { description: 'court' }],
  ])(
    'refuse de rouvrir ou publier une offre incomplète ou expirée (%s) : 409',
    async (_label, override) => {
      for (const status of ['DRAFT', 'CLOSED'] as const) {
        const { service, update } = setupStatus('APPROVED', {
          ...complete,
          ...override,
          status,
          publishedAt: status === 'CLOSED' ? new Date() : null,
        });
        const error = await errorOf(
          service.changeStatus('u', 'o-1', 'PUBLISHED'),
        );
        expect(error).toBeInstanceOf(ConflictException);
        expect(update).not.toHaveBeenCalled();
      }
    },
  );

  it('traduit les refus : droits → 403, état de l’offre → 409', async () => {
    const pending = setupStatus('PENDING', complete);
    expect(
      await errorOf(pending.service.changeStatus('u', 'o-1', 'PUBLISHED')),
    ).toBeInstanceOf(ForbiddenException);

    const draft = setupStatus('APPROVED', complete);
    expect(
      await errorOf(draft.service.changeStatus('u', 'o-1', 'CLOSED')),
    ).toBeInstanceOf(ConflictException);
    expect(draft.update).not.toHaveBeenCalled();
  });

  it('distingue par le code : transition interdite, offre non publiable, introuvable', async () => {
    const bodyOf = (error: unknown) =>
      (error as { getResponse: () => unknown }).getResponse();

    const transition = setupStatus('APPROVED', complete); // brouillon
    expect(
      bodyOf(
        await errorOf(transition.service.changeStatus('u', 'o', 'CLOSED')),
      ),
    ).toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });

    const incomplete = setupStatus('APPROVED', {
      ...complete,
      description: 'court',
      deadline: null,
    });
    expect(
      bodyOf(
        await errorOf(incomplete.service.changeStatus('u', 'o', 'PUBLISHED')),
      ),
    ).toMatchObject({
      statusCode: 409,
      code: 'OFFER_NOT_PUBLISHABLE',
      details: [{ field: 'description' }, { field: 'deadline' }],
    });

    const missing = setupStatus('APPROVED', null);
    expect(
      bodyOf(await errorOf(missing.service.changeStatus('u', 'o', 'CLOSED'))),
    ).toEqual({
      statusCode: 404,
      error: 'Not Found',
      code: 'OFFER_NOT_FOUND',
      message: OFFER_NOT_FOUND,
    });
  });
});

describe('Format des erreurs du service (code stable + détails)', () => {
  const bodyOf = (error: unknown) =>
    (error as { getResponse: () => unknown }).getResponse();

  it('création invalide : VALIDATION_FAILED avec le champ de chaque erreur', async () => {
    const { service } = setup('APPROVED', { city: false, domain: true });
    const error = await errorOf(
      service.create('u', {
        ...publishable,
        contractType: 'CDI',
        duration: '1 an',
        deadline: null,
      }),
    );
    expect(bodyOf(error)).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: [
        { field: 'cityId' },
        { field: 'duration' },
        { field: 'deadline' },
      ],
    });
  });

  it.each([
    ['REJECTED', draft, 'COMPANY_REJECTED'],
    ['PENDING', publishable, 'COMPANY_NOT_APPROVED'],
  ] as const)(
    'création refusée (%s) : 403 avec le code %s',
    async (status, dto, code) => {
      const error = await errorOf(setup(status).service.create('u', dto));
      expect(bodyOf(error)).toMatchObject({ statusCode: 403, code });
    },
  );
});
