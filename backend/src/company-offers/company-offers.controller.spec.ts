import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth/auth.decorators.js';
import { CompanyOffersController } from './company-offers.controller.js';
import type { CompanyOffersService } from './company-offers.service.js';

/**
 * Garde-fous sur la configuration de sécurité du contrôleur : si quelqu'un
 * ajoute @Public() ou retire @Roles('COMPANY'), ces tests échouent.
 */
describe('CompanyOffersController', () => {
  const reflector = new Reflector();
  // Même lecture que les gardes globales : décorateurs de la méthode, puis de la classe.
  const listHandler = Object.getOwnPropertyDescriptor(
    CompanyOffersController.prototype,
    'list',
  )?.value as () => unknown;
  const metadata = (key: string) =>
    reflector.getAllAndOverride<unknown>(key, [
      listHandler,
      CompanyOffersController,
    ]);

  it('est réservé au rôle COMPANY', () => {
    expect(metadata(ROLES_KEY)).toEqual(['COMPANY']);
  });

  it('n’est jamais public (jeton obligatoire)', () => {
    expect(metadata(IS_PUBLIC_KEY)).toBeUndefined();
  });

  it('transmet uniquement l’identifiant de l’utilisateur connecté au service', async () => {
    const listMine = vi.fn().mockResolvedValue({ data: [], meta: {} });
    const controller = new CompanyOffersController({
      listMine,
    } as unknown as CompanyOffersService);
    await controller.list({ id: 'user-1', role: 'COMPANY' });
    expect(listMine).toHaveBeenCalledWith('user-1');
  });
});
