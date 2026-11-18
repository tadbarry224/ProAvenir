import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CompanyOffersModule } from './company-offers/company-offers.module.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { OffersModule } from './offers/offers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferenceModule } from './reference/reference.module.js';

@Module({
  imports: [
    // Lit backend/.env, valide les variables et rend ConfigService disponible partout.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ReferenceModule,
    OffersModule,
    CompanyOffersModule,
  ],
})
export class AppModule {}
