import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminCompaniesModule } from './admin-companies/admin-companies.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { CandidateProfileModule } from './candidate-profile/candidate-profile.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CompanyOffersModule } from './company-offers/company-offers.module.js';
import { CompanyProfileModule } from './company-profile/company-profile.module.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { OffersModule } from './offers/offers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferenceModule } from './reference/reference.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    // Lit backend/.env, valide les variables et rend ConfigService disponible partout.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    ReferenceModule,
    OffersModule,
    CompanyOffersModule,
    CompanyProfileModule,
    AdminCompaniesModule,
    ApplicationsModule,
    CandidateProfileModule,
  ],
})
export class AppModule {}
