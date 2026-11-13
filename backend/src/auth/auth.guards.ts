import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IS_PUBLIC_KEY,
  ROLES_KEY,
  type AuthenticatedRequest,
} from './auth.decorators.js';

/** Contenu signé du jeton d'accès. */
export interface AccessTokenPayload {
  sub: string; // identifiant de l'utilisateur
  role: UserRole;
}

const UNAUTHENTICATED = 'Connexion requise.';

/**
 * Garde GLOBALE : toute route exige un jeton d'accès valide
 * (en-tête `Authorization: Bearer …`), sauf celles marquées @Public().
 *
 * Le compte est relu en base à chaque requête : un compte désactivé ou supprimé
 * perd l'accès immédiatement, et le rôle utilisé est toujours le rôle actuel.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(UNAUTHENTICATED);
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException(UNAUTHENTICATED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException(UNAUTHENTICATED);

    request.user = { id: user.id, role: user.role };
    return true;
  }
}

/** Garde GLOBALE : applique @Roles(...) ; sans ce décorateur, tout rôle connecté passe. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Accès réservé.');
    }
    return true;
  }
}

/** En-tête que seul le frontend ProAvenir envoie, sur les routes à cookie. */
export const CSRF_HEADER = 'x-proavenir-csrf';

/**
 * Protection CSRF des routes qui lisent le cookie de rafraîchissement.
 * Elle s'ajoute au cookie `SameSite=Strict` (défense en profondeur) :
 * 1. l'en-tête personnalisé X-ProAvenir-CSRF est obligatoire. Un site tiers ne
 *    peut pas l'ajouter sans une autorisation CORS, que le serveur lui refuse ;
 * 2. si le navigateur indique une origine (en-tête Origin), elle doit faire partie
 *    de CORS_ORIGIN.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.allowedOrigins = config.get('CORS_ORIGINS', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const origin = request.headers.origin;
    if (
      request.headers[CSRF_HEADER] !== '1' ||
      (origin !== undefined && !this.allowedOrigins.includes(origin))
    ) {
      throw new ForbiddenException('Requête refusée (protection CSRF).');
    }
    return true;
  }
}
