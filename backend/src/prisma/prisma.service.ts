import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { EnvironmentVariables } from '../config/env.validation.js';

/**
 * Accès unique à la base de données pour toute l'application.
 *
 * Depuis Prisma 7, le client passe par un « adaptateur » : ici PrismaPg,
 * qui s'appuie sur le pilote PostgreSQL standard de Node (`pg`).
 * Les autres services l'injectent : `constructor(private prisma: PrismaService) {}`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connexion à PostgreSQL établie.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
