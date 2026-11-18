import {
  isPubliclyVisible,
  toCompanyOffer,
  type CompanyOfferRow,
} from './company-offer.js';

const TODAY = '2026-11-20';

function row(overrides: Partial<CompanyOfferRow> = {}): CompanyOfferRow {
  return {
    id: 'offer-1',
    title: 'Offre de test',
    type: 'JOB',
    contractType: null,
    workSchedule: null,
    duration: null,
    status: 'PUBLISHED',
    description: 'Description',
    deadline: new Date('2026-12-31T00:00:00.000Z'),
    skills: ['Excel'],
    featured: false,
    publishedAt: new Date('2026-11-01T12:00:00.000Z'),
    closedAt: null,
    createdAt: new Date('2026-10-30T08:00:00.000Z'),
    updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    city: { id: 'conakry', name: 'Conakry' },
    domain: { id: 'commerce', name: 'Commerce' },
    _count: { applications: 3 },
    ...overrides,
  };
}

describe('isPubliclyVisible (même règle que l’API publique)', () => {
  const visible = (
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED',
    deadline: string | null,
    companyStatus: 'APPROVED' | 'PENDING' | 'REJECTED' = 'APPROVED',
  ) => isPubliclyVisible({ status, deadline }, companyStatus, TODAY);

  it('publiée, date limite à venir ou aujourd’hui, entreprise validée : visible', () => {
    expect(visible('PUBLISHED', '2026-12-31')).toBe(true);
    expect(visible('PUBLISHED', TODAY)).toBe(true);
  });

  it('expirée (date limite passée) : invisible, même publiée', () => {
    expect(visible('PUBLISHED', '2026-11-19')).toBe(false);
  });

  it('brouillon ou clôturée : invisible, même avec une date à venir', () => {
    expect(visible('DRAFT', '2026-12-31')).toBe(false);
    expect(visible('CLOSED', '2026-12-31')).toBe(false);
    expect(visible('DRAFT', null)).toBe(false);
  });

  it('entreprise en attente ou refusée : invisible', () => {
    expect(visible('PUBLISHED', '2026-12-31', 'PENDING')).toBe(false);
    expect(visible('PUBLISHED', '2026-12-31', 'REJECTED')).toBe(false);
  });
});

describe('toCompanyOffer', () => {
  it('convertit les dates et remplace _count par applicationsCount', () => {
    const offer = toCompanyOffer(row(), { status: 'APPROVED' }, TODAY);
    expect(offer).toMatchObject({
      deadline: '2026-12-31',
      publishedAt: '2026-11-01T12:00:00.000Z',
      closedAt: null,
      createdAt: '2026-10-30T08:00:00.000Z',
      applicationsCount: 3,
      publiclyVisible: true,
    });
    expect(offer).not.toHaveProperty('_count');
  });

  it('accepte un brouillon sans date limite ni date de publication', () => {
    const offer = toCompanyOffer(
      row({ status: 'DRAFT', deadline: null, publishedAt: null }),
      { status: 'APPROVED' },
      TODAY,
    );
    expect(offer).toMatchObject({
      status: 'DRAFT',
      deadline: null,
      publishedAt: null,
      publiclyVisible: false,
    });
  });

  it('renvoie closedAt pour une offre clôturée', () => {
    const offer = toCompanyOffer(
      row({ status: 'CLOSED', closedAt: new Date('2026-11-10T09:00:00Z') }),
      { status: 'APPROVED' },
      TODAY,
    );
    expect(offer.closedAt).toBe('2026-11-10T09:00:00.000Z');
    expect(offer.publiclyVisible).toBe(false);
  });
});
