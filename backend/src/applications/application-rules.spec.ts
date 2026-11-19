import { ValidationPipe } from '@nestjs/common';
import { validationPipeOptions } from '../app.setup.js';
import type { ApiErrorBody } from '../common/api-error.js';
import { applicationTransitionRefusal } from './application-rules.js';
import {
  ChangeApplicationStatusDto,
  CreateApplicationDto,
} from './dto/application.dto.js';

describe('applicationTransitionRefusal', () => {
  it('autorise une étape à la fois, et le refus depuis toute étape non finale', () => {
    expect(applicationTransitionRefusal('SENT', 'IN_REVIEW')).toBeNull();
    expect(applicationTransitionRefusal('IN_REVIEW', 'SHORTLISTED')).toBeNull();
    expect(applicationTransitionRefusal('SHORTLISTED', 'ACCEPTED')).toBeNull();
    for (const from of ['SENT', 'IN_REVIEW', 'SHORTLISTED'] as const) {
      expect(applicationTransitionRefusal(from, 'REJECTED')).toBeNull();
    }
  });

  it('refuse de sauter une étape ou de revenir en arrière', () => {
    expect(applicationTransitionRefusal('SENT', 'ACCEPTED')).toBe(
      'Une candidature envoyée ne peut pas passer à « retenue ».',
    );
    expect(applicationTransitionRefusal('SHORTLISTED', 'IN_REVIEW')).toMatch(
      /ne peut pas passer à « en examen »/,
    );
  });

  it('une réponse définitive (retenue, refusée) ne change plus', () => {
    expect(applicationTransitionRefusal('ACCEPTED', 'REJECTED')).toBe(
      'Cette candidature est déjà retenue : son statut est définitif.',
    );
    expect(applicationTransitionRefusal('REJECTED', 'REJECTED')).toBe(
      'Cette candidature est déjà refusée.',
    );
  });
});

const pipe = new ValidationPipe(validationPipeOptions);
async function validate<T extends object>(
  metatype: new () => T,
  body: Record<string, unknown>,
) {
  try {
    const dto = (await pipe.transform(body, { type: 'body', metatype })) as T;
    return { dto, errors: [] as string[] };
  } catch (error) {
    const response = (
      error as { getResponse: () => ApiErrorBody }
    ).getResponse();
    return { dto: null, errors: response.message as string[] };
  }
}

const OFFER_ID = '30000000-0000-4000-8000-000000000001';

describe('CreateApplicationDto', () => {
  it('accepte une offre seule, ou avec un message nettoyé', async () => {
    expect(
      (await validate(CreateApplicationDto, { offerId: OFFER_ID })).errors,
    ).toEqual([]);
    const { dto } = await validate(CreateApplicationDto, {
      offerId: OFFER_ID,
      message: '  Bonjour, je suis motivée.  ',
    });
    expect(dto?.message).toBe('Bonjour, je suis motivée.');
  });

  it('un message vide est ignoré', async () => {
    const { dto, errors } = await validate(CreateApplicationDto, {
      offerId: OFFER_ID,
      message: '   ',
    });
    expect(errors).toEqual([]);
    expect(dto?.message).toBeUndefined();
  });

  it('refuse une offre invalide, un message trop long et les champs non prévus', async () => {
    expect(
      (await validate(CreateApplicationDto, { offerId: 'abc' })).errors,
    ).toEqual(['Choisissez une offre valide.']);
    expect(
      (
        await validate(CreateApplicationDto, {
          offerId: OFFER_ID,
          message: 'x'.repeat(1001),
        })
      ).errors,
    ).toEqual([
      'Le message au recruteur ne doit pas dépasser 1000 caractères.',
    ]);
    expect(
      (
        await validate(CreateApplicationDto, {
          offerId: OFFER_ID,
          status: 'ACCEPTED',
        })
      ).errors,
    ).toEqual(['property status should not exist']);
  });
});

describe('ChangeApplicationStatusDto', () => {
  it('refuse le retour à « envoyée » et les statuts inconnus', async () => {
    for (const status of ['SENT', 'DONE', undefined]) {
      expect(
        (await validate(ChangeApplicationStatusDto, { status })).errors,
      ).toEqual([
        'Le statut doit valoir IN_REVIEW, SHORTLISTED, ACCEPTED ou REJECTED.',
      ]);
    }
  });
});
