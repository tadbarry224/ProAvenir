import { ValidationPipe } from '@nestjs/common';
import { validationPipeOptions } from '../app.setup.js';
import type { ApiErrorBody } from '../common/api-error.js';
import { isPdf, safeFileName } from './cv-rules.js';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto.js';

describe('isPdf', () => {
  it('reconnaît un PDF à son contenu, pas à son nom', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n…'))).toBe(true);
    expect(isPdf(Buffer.from('MZ exécutable renommé en .pdf'))).toBe(false);
    expect(isPdf(Buffer.from('<html>'))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });
});

describe('safeFileName', () => {
  it('redécode un nom UTF-8 lu en latin1 par multer', () => {
    const asReceived = Buffer.from('CV_Aïssatou.pdf', 'utf8').toString(
      'latin1',
    );
    expect(safeFileName(asReceived)).toBe('CV_Aïssatou.pdf');
  });

  it('ne garde jamais de chemin ni de caractère dangereux', () => {
    expect(safeFileName('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(safeFileName('C:\\Users\\moi\\mon "CV".pdf')).toBe('mon CV.pdf');
    expect(safeFileName('cv\u0000<script>.PDF')).toBe('cvscript.pdf');
  });

  it('termine toujours par .pdf, avec un nom par défaut et une longueur limitée', () => {
    expect(safeFileName('Curriculum')).toBe('Curriculum.pdf');
    expect(safeFileName('.pdf')).toBe('CV.pdf');
    const long = safeFileName(`${'a'.repeat(300)}.pdf`);
    expect(long.length).toBe(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });
});

const pipe = new ValidationPipe(validationPipeOptions);
async function validate(body: Record<string, unknown>) {
  try {
    const dto = (await pipe.transform(body, {
      type: 'body',
      metatype: UpdateCandidateProfileDto,
    })) as UpdateCandidateProfileDto;
    return { dto, errors: [] as string[] };
  } catch (error) {
    const response = (
      error as { getResponse: () => ApiErrorBody }
    ).getResponse();
    return { dto: null, errors: response.message as string[] };
  }
}

describe('UpdateCandidateProfileDto', () => {
  it('nettoie les textes ; un texte vide efface la valeur', async () => {
    const { dto, errors } = await validate({
      fullName: '  Aïssatou   Bah ',
      cityId: '',
      education: '  ',
      bio: ' Motivée ',
      skills: [' Excel', 'excel', 'Word '],
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      fullName: 'Aïssatou Bah',
      cityId: null,
      education: null,
      bio: 'Motivée',
      skills: ['Excel', 'Word'],
    });
  });

  it('accepte un corps partiel', async () => {
    const { dto, errors } = await validate({ bio: 'Bonjour' });
    expect(errors).toEqual([]);
    expect(dto?.fullName).toBeUndefined();
  });

  it('refuse les valeurs invalides et les champs non prévus', async () => {
    expect((await validate({ fullName: 'A' })).errors).toEqual([
      'Le nom complet doit contenir entre 2 et 100 caractères.',
    ]);
    expect((await validate({ cityId: '../conakry' })).errors).toEqual([
      'Choisissez une ville dans la liste.',
    ]);
    expect((await validate({ bio: 'x'.repeat(1001) })).errors).toEqual([
      'La présentation doit faire au maximum 1000 caractères.',
    ]);
    expect(
      (
        await validate({
          skills: Array.from({ length: 21 }, (_, i) => `c${i}`),
        })
      ).errors,
    ).toEqual(['Indiquez au maximum 20 compétences.']);
    expect((await validate({ email: 'autre@exemple.gn' })).errors).toEqual([
      'property email should not exist',
    ]);
    expect((await validate({ cvFileKey: 'x' })).errors).toEqual([
      'property cvFileKey should not exist',
    ]);
  });
});
