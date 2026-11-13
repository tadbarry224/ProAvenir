import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CompanyStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from './auth.guards.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { getDummyHash, hashPassword, verifyPassword } from './password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  SESSION_MAX_HOURS,
} from './refresh-cookie.js';

/** Utilisateur renvoyé au frontend : jamais de hash ni de donnée interne. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  company: { id: string; name: string; status: CompanyStatus } | null;
}

/** Réponse des routes register / login / refresh. */
export interface AuthResponse {
  accessToken: string;
  /** Durée de validité du jeton d'accès, en secondes. */
  expiresIn: number;
  user: SessionUser;
}

/** Résultat interne : la réponse + de quoi poser le cookie. */
export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
  persistent: boolean;
  expiresAt: Date;
}

/**
 * Délai pendant lequel un jeton qui vient d'être remplacé n'est PAS considéré
 * comme volé : deux onglets peuvent rafraîchir la session au même moment.
 * Le second reçoit une erreur `SESSION_ROTATED` et réessaie avec le nouveau cookie.
 */
const ROTATION_GRACE_MS = 30_000;

const INVALID_CREDENTIALS = 'E-mail ou mot de passe incorrect.';
const SESSION_EXPIRED = 'Session expirée. Veuillez vous reconnecter.';

const sessionUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  companyMembers: {
    select: { company: { select: { id: true, name: true, status: true } } },
    take: 1,
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: number;
  private readonly rememberMeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.accessTtl = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    this.rememberMeDays = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
  }

  /**
   * Inscription d'un candidat (compte + profil) ou d'une entreprise
   * (compte propriétaire + entreprise EN ATTENTE de validation + lien OWNER),
   * dans une seule transaction : tout est créé, ou rien.
   */
  async register(dto: RegisterDto): Promise<IssuedSession> {
    const passwordHash = await hashPassword(dto.password);
    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            role: dto.role,
          },
          select: { id: true },
        });
        if (dto.role === 'CANDIDATE') {
          await tx.candidateProfile.create({ data: { userId: user.id } });
        } else {
          await tx.company.create({
            data: {
              name: dto.companyName as string,
              status: 'PENDING',
              members: { create: { userId: user.id, role: 'OWNER' } },
            },
          });
        }
        return user.id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Un compte existe déjà avec cette adresse e-mail.',
        );
      }
      throw error;
    }
    return this.startSession(userId, false);
  }

  /**
   * Connexion. Toutes les causes d'échec (e-mail inconnu, mauvais mot de passe,
   * compte sans mot de passe ou désactivé) donnent le MÊME message, et un mot de
   * passe est toujours vérifié (temps de réponse comparable).
   */
  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, isActive: true, passwordHash: true },
    });
    const passwordOk = await verifyPassword(
      user?.passwordHash ?? (await getDummyHash()),
      dto.password,
    );
    if (!user?.passwordHash || !user.isActive || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.startSession(user.id, dto.rememberMe === true);
  }

  /**
   * Rotation : le jeton présenté est révoqué et remplacé par un nouveau, qui
   * conserve la fin de session et le choix « Se souvenir de moi ».
   * - Jeton inconnu ou expiré → 401.
   * - Jeton déjà remplacé il y a moins de 30 s → 401 SESSION_ROTATED (onglets
   *   concurrents : le client réessaie avec le nouveau cookie).
   * - Jeton déjà révoqué depuis plus longtemps → probable VOL : toutes les
   *   sessions du compte sont révoquées.
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException(SESSION_EXPIRED);
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        persistent: true,
        revokedAt: true,
        user: { select: { isActive: true } },
      },
    });
    if (!stored) throw new UnauthorizedException(SESSION_EXPIRED);

    if (stored.revokedAt) {
      if (now.getTime() - stored.revokedAt.getTime() <= ROTATION_GRACE_MS) {
        throw this.sessionRotated();
      }
      await this.revokeAllSessions(stored.userId, now);
      this.logger.warn(
        `Réutilisation d'un jeton révoqué : sessions du compte ${stored.userId} révoquées.`,
      );
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (stored.expiresAt <= now || !stored.user.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const refreshToken = generateRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      // Révocation ATOMIQUE : si deux requêtes arrivent en même temps, une seule
      // trouve encore `revokedAt = null` ; l'autre obtient count = 0.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) throw this.sessionRotated();
      await tx.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: stored.expiresAt,
          persistent: stored.persistent,
        },
      });
    });
    return {
      response: await this.buildResponse(stored.userId),
      refreshToken,
      persistent: stored.persistent,
      expiresAt: stored.expiresAt,
    };
  }

  /** Déconnexion : révoque la session de ce cookie (sans erreur si elle n'existe plus). */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: sessionUserSelect,
    });
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    const { companyMembers, ...rest } = user;
    return { ...rest, company: companyMembers[0]?.company ?? null };
  }

  /** Révoque toutes les sessions actives d'un compte (vol détecté, nouveau mot de passe…). */
  revokeAllSessions(userId: string, now = new Date()) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private async startSession(
    userId: string,
    persistent: boolean,
  ): Promise<IssuedSession> {
    const hours = persistent ? this.rememberMeDays * 24 : SESSION_MAX_HOURS;
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    const refreshToken = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        persistent,
      },
    });
    return {
      response: await this.buildResponse(userId),
      refreshToken,
      persistent,
      expiresAt,
    };
  }

  private async buildResponse(userId: string): Promise<AuthResponse> {
    const user = await this.me(userId);
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
    });
    return { accessToken, expiresIn: this.accessTtl, user };
  }

  private sessionRotated() {
    return new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      code: 'SESSION_ROTATED',
      message: 'Session renouvelée par une autre requête. Réessayez.',
    });
  }
}
