import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { CvStorage } from './cv-storage.service.js';

/** Stockage des fichiers (CV), disponible dans toute l'application. */
@Global()
@Module({
  providers: [
    {
      provide: CvStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new CvStorage(config.get('CV_STORAGE_DIR', { infer: true })),
    },
  ],
  exports: [CvStorage],
})
export class StorageModule {}
