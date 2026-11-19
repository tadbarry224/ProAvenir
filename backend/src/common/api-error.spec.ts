import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  type ValidationError,
} from '@nestjs/common';
import {
  apiError,
  validationException,
  VALIDATION_FAILED,
} from './api-error.js';

describe('apiError', () => {
  it.each([
    [400, BadRequestException, 'Bad Request'],
    [403, ForbiddenException, 'Forbidden'],
    [404, NotFoundException, 'Not Found'],
    [409, ConflictException, 'Conflict'],
  ] as const)('%s → %s avec code et message', (status, Exception, error) => {
    const exception = apiError(status, 'MON_CODE', 'Message affiché.');
    expect(exception).toBeInstanceOf(Exception);
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({
      statusCode: status,
      error,
      code: 'MON_CODE',
      message: 'Message affiché.',
    });
  });

  it('sans message : la liste des messages des détails, détails inclus', () => {
    const details = [
      { field: 'deadline', message: 'Date obligatoire.' },
      { field: 'description', message: 'Description trop courte.' },
    ];
    expect(apiError(409, 'X', null, details).getResponse()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      code: 'X',
      message: ['Date obligatoire.', 'Description trop courte.'],
      details,
    });
  });
});

describe('validationException (erreurs des DTO)', () => {
  it('garde la liste des messages et ajoute le code et les champs (y compris imbriqués)', () => {
    const errors: ValidationError[] = [
      { property: 'title', constraints: { isLength: 'Titre trop court.' } },
      {
        property: 'contact',
        children: [
          { property: 'email', constraints: { isEmail: 'E-mail invalide.' } },
        ],
      },
    ];
    expect(validationException(errors).getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: VALIDATION_FAILED,
      message: ['Titre trop court.', 'E-mail invalide.'],
      details: [
        { field: 'title', message: 'Titre trop court.' },
        { field: 'contact.email', message: 'E-mail invalide.' },
      ],
    });
  });
});
