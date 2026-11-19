import { ValidationPipe } from '@nestjs/common';
import { validationPipeOptions } from '../../app.setup.js';
import type { ApiErrorBody } from '../../common/api-error.js';
import { ReviewCompanyDto } from './review-company.dto.js';

/** Valide le corps exactement comme l'application (mêmes options que app.setup.ts). */
const pipe = new ValidationPipe(validationPipeOptions);

async function validateBody(body: Record<string, unknown>) {
  try {
    const dto = (await pipe.transform(body, {
      type: 'body',
      metatype: ReviewCompanyDto,
    })) as ReviewCompanyDto;
    return { dto, errors: [] as string[] };
  } catch (error) {
    const response = (
      error as { getResponse: () => ApiErrorBody }
    ).getResponse();
    return { dto: null, errors: response.message as string[] };
  }
}

describe('ReviewCompanyDto', () => {
  it('accepte une approbation sans motif', async () => {
    const { dto, errors } = await validateBody({ status: 'APPROVED' });
    expect(errors).toEqual([]);
    expect(dto?.status).toBe('APPROVED');
  });

  it('accepte un refus motivé et nettoie les espaces du motif', async () => {
    const { dto, errors } = await validateBody({
      status: 'REJECTED',
      reason: '  Numéro   RCCM\n manquant  ',
    });
    expect(errors).toEqual([]);
    expect(dto?.reason).toBe('Numéro RCCM manquant');
  });

  it('exige un motif pour un refus', async () => {
    for (const reason of [undefined, '', '   ']) {
      const { errors } = await validateBody({ status: 'REJECTED', reason });
      expect(errors).toEqual(['Le motif du refus est obligatoire.']);
    }
  });

  it('limite la longueur du motif', async () => {
    for (const reason of ['abc', 'x'.repeat(501)]) {
      const { errors } = await validateBody({ status: 'REJECTED', reason });
      expect(errors).toEqual([
        'Le motif du refus doit contenir entre 5 et 500 caractères.',
      ]);
    }
  });

  it('refuse un motif pour une approbation', async () => {
    const { errors } = await validateBody({
      status: 'APPROVED',
      reason: 'Tout est en ordre',
    });
    expect(errors).toEqual(['Une approbation ne prend pas de motif.']);
  });

  it('refuse un retour « en attente », un statut inconnu et les champs non prévus', async () => {
    for (const status of ['PENDING', 'approved', undefined]) {
      const { errors } = await validateBody({ status });
      expect(errors).toEqual([
        'Le statut doit valoir APPROVED (approuver) ou REJECTED (refuser).',
      ]);
    }
    const { errors } = await validateBody({
      status: 'APPROVED',
      reviewedAt: '2020-01-01',
    });
    expect(errors).toEqual(['property reviewedAt should not exist']);
  });
});
