import {
  collapseSpaces,
  contractErrors,
  creationRefusal,
  isValidIsoDate,
  normalizeSkills,
  PERMISSION_MESSAGES,
  publicationErrors,
} from './offer-rules.js';

const TODAY = '2026-11-20';
const LONG_DESCRIPTION = 'x'.repeat(50);

describe('creationRefusal (droit de créer selon le statut de l’entreprise)', () => {
  it.each([
    ['APPROVED', 'DRAFT', null],
    ['APPROVED', 'PUBLISHED', null],
    ['PENDING', 'DRAFT', null],
    ['PENDING', 'PUBLISHED', PERMISSION_MESSAGES.pendingPublish],
    ['REJECTED', 'DRAFT', PERMISSION_MESSAGES.rejected],
    ['REJECTED', 'PUBLISHED', PERMISSION_MESSAGES.rejected],
  ] as const)('%s + %s → %s', (companyStatus, status, expected) => {
    expect(creationRefusal(companyStatus, status)).toBe(expected);
  });
});

describe('contractErrors (cohérence contrat / type, comme les CHECK de la base)', () => {
  it.each([
    ['JOB', 'CDI', null],
    ['JOB', 'CDD', '6 mois'],
    ['JOB', 'OTHER', null],
    ['INTERNSHIP', 'INTERNSHIP', '3 mois'],
    ['INTERNSHIP', 'OTHER', null],
    ['JOB', null, '3 mois'],
    ['INTERNSHIP', undefined, undefined],
  ] as const)(
    '%s + %s (durée %s) : accepté',
    (type, contractType, duration) => {
      expect(contractErrors({ type, contractType, duration })).toEqual([]);
    },
  );

  it('refuse un contrat de stage pour un emploi, et un CDI/CDD pour un stage', () => {
    expect(contractErrors({ type: 'JOB', contractType: 'INTERNSHIP' })).toEqual(
      ['Pour un emploi, le contrat doit être un CDI, un CDD ou « Autre ».'],
    );
    expect(contractErrors({ type: 'INTERNSHIP', contractType: 'CDI' })).toEqual(
      [
        'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
      ],
    );
  });

  it('refuse une durée pour un CDI', () => {
    expect(
      contractErrors({ type: 'JOB', contractType: 'CDI', duration: '1 an' }),
    ).toEqual(['Un CDI n’a pas de durée : laissez la durée vide.']);
  });
});

describe('publicationErrors (conditions pour publier)', () => {
  it('accepte une description de 50 caractères et une date aujourd’hui ou plus tard', () => {
    const ok = (deadline: string) =>
      publicationErrors({ description: LONG_DESCRIPTION, deadline }, TODAY);
    expect(ok(TODAY)).toEqual([]);
    expect(ok('2027-01-15')).toEqual([]);
  });

  it('exige une description et une date limite', () => {
    expect(
      publicationErrors({ description: '   ', deadline: null }, TODAY),
    ).toEqual([
      'La description est obligatoire pour publier.',
      'La date limite est obligatoire pour publier.',
    ]);
  });

  it('refuse une description trop courte (espaces retirés) et une date passée', () => {
    expect(
      publicationErrors(
        { description: `  ${'x'.repeat(49)}  `, deadline: '2026-11-19' },
        TODAY,
      ),
    ).toEqual([
      'La description doit contenir au moins 50 caractères pour publier (actuellement 49).',
      'La date limite ne peut pas être dans le passé.',
    ]);
  });
});

describe('outils de nettoyage', () => {
  it('collapseSpaces retire les espaces superflus', () => {
    expect(collapseSpaces('  Assistant   marketing  ')).toBe(
      'Assistant marketing',
    );
  });

  it('normalizeSkills retire vides et doublons (sans tenir compte des majuscules)', () => {
    expect(
      normalizeSkills(['Excel', ' excel ', '', 'Gestion   de stock']),
    ).toEqual(['Excel', 'Gestion de stock']);
  });

  it('isValidIsoDate n’accepte que des dates réelles au format AAAA-MM-JJ', () => {
    expect(isValidIsoDate('2026-12-31')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('31/12/2026')).toBe(false);
    expect(isValidIsoDate('2026-12-31T00:00:00Z')).toBe(false);
  });
});
