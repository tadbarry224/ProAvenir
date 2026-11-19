import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ClockService } from '../common/clock.service.js';
import type { CompanyStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CompanyMembershipService } from './company-membership.service.js';
import { CompanyOffersService } from './company-offers.service.js';
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
