import { ValidationPipe } from '@nestjs/common';
import { CreateCompanyOfferDto } from './create-company-offer.dto.js';

/**
 * Valide le corps exactement comme l'application (même configuration que
 * app.setup.ts) : renvoie le DTO nettoyé, ou la liste des messages d'erreur.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateBody(body: Record<string, unknown>) {
  try {
    const dto = (await pipe.transform(body, {
      type: 'body',
      metatype: CreateCompanyOfferDto,
    })) as CreateCompanyOfferDto;
    return { dto, errors: [] as string[] };
  } catch (error) {
    const response = (
      error as { getResponse: () => { message: string[] } }
    ).getResponse();
    return { dto: null, errors: response.message };
  }
}

const minimal = {
  status: 'DRAFT',
  title: 'Assistant marketing',
  type: 'JOB',
  cityId: 'conakry',
  domainId: 'marketing',
};

describe('CreateCompanyOfferDto', () => {
  it('accepte un brouillon minimal', async () => {
    const { dto, errors } = await validateBody(minimal);
    expect(errors).toEqual([]);
    expect(dto).toMatchObject(minimal);
  });

  it('nettoie l’intitulé, les compétences, la date et la durée vides', async () => {
    const { dto } = await validateBody({
      ...minimal,
      title: '  Assistant    marketing ',
      skills: ['Excel', ' excel ', '  ', 'Word'],
      deadline: '  ',
      duration: '',
    });
    expect(dto).toMatchObject({
      title: 'Assistant marketing',
      skills: ['Excel', 'Word'],
      deadline: null,
      duration: null,
    });
  });

  it.each([
    ['companyId', '94000000-0000-4000-8000-000000000002'],
    ['featured', true],
    ['publishedAt', '2026-11-01T00:00:00Z'],
    ['closedAt', null],
    ['id', '94000000-0000-4000-8000-000000000099'],
  ])('refuse le champ réservé « %s »', async (field, value) => {
    const { errors } = await validateBody({ ...minimal, [field]: value });
    expect(errors).toEqual([`property ${field} should not exist`]);
  });

  it.each([
    [{ status: 'CLOSED' }, 'Le statut doit valoir DRAFT'],
    [{ title: 'ab' }, 'L’intitulé doit contenir entre 3 et 120 caractères.'],
    [{ title: 'x'.repeat(121) }, 'entre 3 et 120 caractères'],
    [{ title: undefined }, 'L’intitulé du poste est obligatoire.'],
    [{ type: 'FREELANCE' }, 'Choisissez un type d’offre valide.'],
    [{ cityId: 'Conakry !' }, 'Choisissez une ville dans la liste.'],
    [{ domainId: undefined }, 'Choisissez un domaine dans la liste.'],
    [{ deadline: '2026-02-30' }, 'La date limite n’est pas valide'],
    [{ deadline: '31/12/2026' }, 'La date limite n’est pas valide'],
    [{ description: 'x'.repeat(5001) }, 'ne doit pas dépasser 5000 caractères'],
    [{ skills: 'Excel' }, 'Les compétences doivent être une liste.'],
    [{ skills: [42] }, 'Chaque compétence doit être un texte.'],
    [
      { skills: Array.from({ length: 11 }, (_, i) => `S${i}`) },
      'Indiquez au maximum 10 compétences.',
    ],
    [{ skills: ['x'.repeat(41)] }, 'au maximum 40 caractères'],
    [{ contractType: 'FREELANCE' }, 'Type de contrat invalide'],
    [{ workSchedule: 'NIGHT' }, 'Rythme invalide'],
    [{ duration: 'x'.repeat(51) }, 'ne doit pas dépasser 50 caractères'],
  ])('refuse %o', async (override, expected) => {
    const { errors } = await validateBody({ ...minimal, ...override });
    expect(errors.join(' | ')).toContain(expected);
  });

  it('accepte les détails du contrat facultatifs, y compris null', async () => {
    const { errors } = await validateBody({
      ...minimal,
      contractType: null,
      workSchedule: 'PART_TIME',
      duration: '6 mois',
    });
    expect(errors).toEqual([]);
  });
});
