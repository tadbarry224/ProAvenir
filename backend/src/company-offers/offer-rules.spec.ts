import {
  collapseSpaces,
  contractErrors,
  creationRefusal,
  isValidIsoDate,
  normalizeSkills,
  OFFER_ERROR_CODES,
  PERMISSION_MESSAGES,
  publicationErrors,
  STATUS_MESSAGES,
  statusChangeDates,
  statusChangeRefusal,
} from './offer-rules.js';

const TODAY = '2026-11-20';
const LONG_DESCRIPTION = 'x'.repeat(50);

describe('creationRefusal (droit de créer selon le statut de l’entreprise)', () => {
  const C = OFFER_ERROR_CODES;
  const notApproved = {
    statusCode: 403,
    code: C.companyNotApproved,
    message: PERMISSION_MESSAGES.pendingPublish,
  };
  const rejected = {
    statusCode: 403,
    code: C.companyRejected,
    message: PERMISSION_MESSAGES.rejected,
  };
  it.each([
    ['APPROVED', 'DRAFT', null],
    ['APPROVED', 'PUBLISHED', null],
    ['PENDING', 'DRAFT', null],
    ['PENDING', 'PUBLISHED', notApproved],
    ['REJECTED', 'DRAFT', rejected],
    ['REJECTED', 'PUBLISHED', rejected],
  ] as const)('%s + %s', (companyStatus, status, expected) => {
    expect(creationRefusal(companyStatus, status)).toEqual(expected);
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
      [
        {
          field: 'contractType',
          message:
            'Pour un emploi, le contrat doit être un CDI, un CDD ou « Autre ».',
        },
      ],
    );
    expect(contractErrors({ type: 'INTERNSHIP', contractType: 'CDI' })).toEqual(
      [
        {
          field: 'contractType',
          message:
            'Pour un stage, le contrat doit être une convention de stage ou « Autre ».',
        },
      ],
    );
  });

  it('refuse une durée pour un CDI', () => {
    expect(
      contractErrors({ type: 'JOB', contractType: 'CDI', duration: '1 an' }),
    ).toEqual([
      {
        field: 'duration',
        message: 'Un CDI n’a pas de durée : laissez la durée vide.',
      },
    ]);
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
      {
        field: 'description',
        message: 'La description est obligatoire pour publier.',
      },
      {
        field: 'deadline',
        message: 'La date limite est obligatoire pour publier.',
      },
    ]);
  });

  it('refuse une description trop courte (espaces retirés) et une date passée', () => {
    expect(
      publicationErrors(
        { description: `  ${'x'.repeat(49)}  `, deadline: '2026-11-19' },
        TODAY,
      ),
    ).toEqual([
      {
        field: 'description',
        message:
          'La description doit contenir au moins 50 caractères pour publier (actuellement 49).',
      },
      {
        field: 'deadline',
        message: 'La date limite ne peut pas être dans le passé.',
      },
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

describe('statusChangeRefusal (transitions et droits)', () => {
  const ok = null;
  const C = OFFER_ERROR_CODES;
  const M = STATUS_MESSAGES;
  // 403 : droits de l'entreprise ; 409 : transition impossible depuis l'état de l'offre.
  const forbidden = (message: string) => ({
    statusCode: 403,
    code:
      message === M.rejectedReadOnly ? C.companyRejected : C.companyNotApproved,
    message,
  });
  const conflict = (message: string) => ({
    statusCode: 409,
    code: C.invalidTransition,
    message,
  });

  // [entreprise, statut actuel, demande, résultat attendu] : les 18 combinaisons.
  it.each([
    ['APPROVED', 'DRAFT', 'PUBLISHED', ok],
    ['APPROVED', 'DRAFT', 'CLOSED', conflict(M.draftCannotClose)],
    ['APPROVED', 'PUBLISHED', 'PUBLISHED', conflict(M.alreadyPublished)],
    ['APPROVED', 'PUBLISHED', 'CLOSED', ok],
    ['APPROVED', 'CLOSED', 'PUBLISHED', ok],
    ['APPROVED', 'CLOSED', 'CLOSED', conflict(M.alreadyClosed)],
    ['PENDING', 'DRAFT', 'PUBLISHED', forbidden(M.approvalRequired)],
    ['PENDING', 'DRAFT', 'CLOSED', conflict(M.draftCannotClose)],
    ['PENDING', 'PUBLISHED', 'PUBLISHED', conflict(M.alreadyPublished)],
    ['PENDING', 'PUBLISHED', 'CLOSED', ok],
    ['PENDING', 'CLOSED', 'PUBLISHED', forbidden(M.approvalRequired)],
    ['PENDING', 'CLOSED', 'CLOSED', conflict(M.alreadyClosed)],
    ['REJECTED', 'DRAFT', 'PUBLISHED', forbidden(M.rejectedReadOnly)],
    ['REJECTED', 'DRAFT', 'CLOSED', forbidden(M.rejectedReadOnly)],
    ['REJECTED', 'PUBLISHED', 'PUBLISHED', forbidden(M.rejectedReadOnly)],
    ['REJECTED', 'PUBLISHED', 'CLOSED', forbidden(M.rejectedReadOnly)],
    ['REJECTED', 'CLOSED', 'PUBLISHED', forbidden(M.rejectedReadOnly)],
    ['REJECTED', 'CLOSED', 'CLOSED', forbidden(M.rejectedReadOnly)],
  ] as const)('%s : %s → %s', (company, current, target, expected) => {
    expect(statusChangeRefusal(company, current, target)).toEqual(expected);
  });
});

describe('statusChangeDates', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const firstPublication = new Date('2026-11-01T12:00:00Z');

  it('publication d’un brouillon : publishedAt = maintenant', () => {
    expect(statusChangeDates('PUBLISHED', null, now)).toEqual({
      publishedAt: now,
      closedAt: null,
    });
  });

  it('réouverture : publishedAt d’origine conservé, closedAt effacé', () => {
    expect(statusChangeDates('PUBLISHED', firstPublication, now)).toEqual({
      publishedAt: firstPublication,
      closedAt: null,
    });
  });

  it('clôture : closedAt = maintenant, publishedAt conservé', () => {
    expect(statusChangeDates('CLOSED', firstPublication, now)).toEqual({
      publishedAt: firstPublication,
      closedAt: now,
    });
  });
});
