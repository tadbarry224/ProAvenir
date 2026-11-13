import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';

/** Utilisateur authentifié, attaché à la requête par JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Route accessible sans connexion. Par défaut, TOUTES les routes exigent un
 * jeton d'accès valide : oublier ce décorateur ferme la route au lieu de l'ouvrir.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Route réservée à certains rôles : @Roles('ADMIN'). Vérifié par RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injecte l'utilisateur connecté : `me(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
