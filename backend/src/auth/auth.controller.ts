import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { CurrentUser, Public, type AuthUser } from './auth.decorators.js';
import { CsrfGuard } from './auth.guards.js';
import {
  AuthService,
  type AuthResponse,
  type IssuedSession,
  type SessionUser,
} from './auth.service.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from './refresh-cookie.js';

const MINUTE = 60_000;

/**
 * Authentification (/api/auth/…).
 * - Les routes à cookie sont protégées contre le CSRF (CsrfGuard).
 * - Le nombre de tentatives est limité par adresse IP (ThrottlerGuard → 429).
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secureCookies =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** POST /api/auth/register : crée un compte candidat ou entreprise et ouvre la session. */
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: 10 * MINUTE } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.open(res, await this.auth.register(dto));
  }

  /** POST /api/auth/login : 5 tentatives par minute et par adresse IP. */
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.open(res, await this.auth.login(dto));
  }

  /** POST /api/auth/refresh : nouveau jeton d'accès + rotation du cookie. */
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.open(res, await this.auth.refresh(this.cookieOf(req)));
    } catch (error) {
      // Session invalide : on efface le cookie, sauf en cas de rotation
      // concurrente (le cookie actuel du navigateur est alors le bon).
      const code = (error as { response?: { code?: string } }).response?.code;
      if (code !== 'SESSION_ROTATED')
        clearRefreshCookie(res, this.secureCookies);
      throw error;
    }
  }

  /** POST /api/auth/logout : révoque la session et efface le cookie (204). */
  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookieOf(req));
    clearRefreshCookie(res, this.secureCookies);
  }

  /** GET /api/auth/me : utilisateur connecté (jeton d'accès obligatoire). */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<SessionUser> {
    return this.auth.me(user.id);
  }

  private cookieOf(req: Request): string | undefined {
    const value: unknown = (
      req.cookies as Record<string, unknown> | undefined
    )?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  private open(res: Response, session: IssuedSession): AuthResponse {
    setRefreshCookie(res, session.refreshToken, session, this.secureCookies);
    return session.response;
  }
}
