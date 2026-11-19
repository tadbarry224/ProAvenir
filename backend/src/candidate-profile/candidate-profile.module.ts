import { Module } from '@nestjs/common';
import { CandidateProfileController } from './candidate-profile.controller.js';
import { CandidateProfileService } from './candidate-profile.service.js';

/** Profil candidat et CV (B6). Le stockage des fichiers vient de StorageModule (global). */
@Module({
  controllers: [CandidateProfileController],
  providers: [CandidateProfileService],
  exports: [CandidateProfileService],
})
export class CandidateProfileModule {}
