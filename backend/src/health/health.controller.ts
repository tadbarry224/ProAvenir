import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}

/**
 * GET /api/health : indique si l'API fonctionne et si la base répond.
 * - 200 { status: "ok", database: "up" }
 * - 503 { status: "error", database: "down" } si PostgreSQL ne répond pas.
 * Aucun détail technique (message d'erreur, adresse de la base) n'est renvoyé :
 * il est seulement écrit dans les journaux du serveur.
 */
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp };
    } catch (error) {
      this.logger.error(
        'PostgreSQL ne répond pas.',
        error instanceof Error ? error.stack : error,
      );
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp,
      } satisfies HealthStatus);
    }
  }
}
