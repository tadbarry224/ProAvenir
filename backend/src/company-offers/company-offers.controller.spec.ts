import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth/auth.decorators.js';
import { CompanyOffersController } from './company-offers.controller.js';
import type { CompanyOffersService } from './company-offers.service.js';
import type { CreateCompanyOfferDto } from './dto/create-company-offer.dto.js';

/**
 * Garde-fous sur la configuration de sécurité du contrôleur : si quelqu'un
 * ajoute @Public() ou retire @Roles('COMPANY'), sur la classe ou sur une route,
 * ces tests échouent.
 */
describe('CompanyOffersController', () => {
  const reflector = new Reflector();
  const ROUTES = ['list', 'create'] as const;

  // Même lecture que les gardes globales : décorateurs de la méthode, puis de la classe.
  const metadata = (route: (typeof ROUTES)[number], key: string) => {
    const handler = Object.getOwnPropertyDescriptor(
      CompanyOffersController.prototype,
      route,
    )?.value as () => unknown;
    return reflector.getAllAndOverride<unknown>(key, [
      handler,
      CompanyOffersController,
    ]);
  };

  it.each(ROUTES)('« %s » est réservée au rôle COMPANY', (route) => {
    expect(metadata(route, ROLES_KEY)).toEqual(['COMPANY']);
  });

  it.each(ROUTES)(
    '« %s » n’est jamais publique (jeton obligatoire)',
    (route) => {
      expect(metadata(route, IS_PUBLIC_KEY)).toBeUndefined();
    },
  );

  it('transmet uniquement l’identifiant de l’utilisateur connecté au service', async () => {
    const listMine = vi.fn().mockResolvedValue({ data: [], meta: {} });
    const create = vi.fn().mockResolvedValue({});
    const controller = new CompanyOffersController({
      listMine,
      create,
    } as unknown as CompanyOffersService);
    const user = { id: 'user-1', role: 'COMPANY' as const };
    const dto = { status: 'DRAFT' } as CreateCompanyOfferDto;

    await controller.list(user);
    await controller.create(user, dto);
    expect(listMine).toHaveBeenCalledWith('user-1');
    expect(create).toHaveBeenCalledWith('user-1', dto);
  });
});
