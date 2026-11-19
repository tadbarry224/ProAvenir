import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import {
  CandidateProfileService,
  type CandidateProfileResponse,
  type UploadedFile as CvFile,
} from './candidate-profile.service.js';
import { CV_UPLOAD_OPTIONS, CvTooLargeFilter, pdfDownload } from './cv-http.js';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto.js';

/**
 * Profil et CV du candidat connecté (rôle CANDIDATE). Le profil est celui de la
 * session : aucun identifiant n'est lu dans l'URL ni dans la requête.
 */
@Roles('CANDIDATE')
@Controller('candidates/me')
export class CandidateProfileController {
  constructor(private readonly profiles: CandidateProfileService) {}

  @Get('profile')
  get(@CurrentUser() user: AuthUser): Promise<CandidateProfileResponse> {
    return this.profiles.get(user.id);
  }

  @Patch('profile')
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfileResponse> {
    return this.profiles.update(user.id, dto);
  }

  /** Dépose ou remplace le CV : formulaire multipart, champ « cv » (PDF, 5 Mo au plus). */
  @Put('cv')
  @UseFilters(CvTooLargeFilter)
  @UseInterceptors(FileInterceptor('cv', CV_UPLOAD_OPTIONS))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: CvFile | undefined,
  ): Promise<CandidateProfileResponse> {
    return this.profiles.uploadCv(user.id, file);
  }

  @Delete('cv')
  remove(@CurrentUser() user: AuthUser): Promise<CandidateProfileResponse> {
    return this.profiles.deleteCv(user.id);
  }

  @Get('cv')
  async download(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return pdfDownload(await this.profiles.downloadOwnCv(user.id), res);
  }
}
