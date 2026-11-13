import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../generated/prisma/enums.js';
import type { AuthUser } from './auth.decorators.js';
import { RolesGuard } from './auth.guards.js';

/** Contexte de requête minimal : un utilisateur et les rôles exigés par la route. */
function context(user: AuthUser | undefined, roles?: UserRole[]) {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => roles;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), ctx };
}

describe('RolesGuard', () => {
  it('laisse passer une route sans @Roles', () => {
    const { guard, ctx } = context({ id: 'u1', role: 'CANDIDATE' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('accepte le bon rôle', () => {
    const { guard, ctx } = context({ id: 'u1', role: 'ADMIN' }, ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuse un autre rôle (403)', () => {
    const { guard, ctx } = context({ id: 'u1', role: 'COMPANY' }, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('refuse sans utilisateur', () => {
    const { guard, ctx } = context(undefined, ['CANDIDATE']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
