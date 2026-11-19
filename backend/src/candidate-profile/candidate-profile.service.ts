import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_ERROR_CODES } from '../applications/application-rules.js';
import { apiError, VALIDATION_FAILED } from '../common/api-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CvStorage } from '../storage/cv-storage.service.js';
import {
  CV_ERROR_CODES,
  CV_MAX_BYTES,
  CV_MESSAGES,
  isPdf,
  safeFileName,
} from './cv-rules.js';
import type { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto.js';

/** Profil renvoyé au candidat connecté (jamais de clé de fichier ni de donnée interne). */
export interface CandidateProfileResponse {
  fullName: string;
  email: string;
  city: { id: string; name: string } | null;
  education: string | null;
  bio: string | null;
  skills: string[];
  /** CV déposé, ou null. */
  cv: { fileName: string; size: number; uploadedAt: string } | null;
}

/** Fichier reçu par multer (seuls les champs utilisés). */
export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface CvDownload {
  fileName: string;
  content: Buffer;
}

const profileSelect = {
  id: true,
  education: true,
  bio: true,
  skills: true,
  cvFileKey: true,
  cvFileName: true,
  cvFileSize: true,
  cvUploadedAt: true,
  city: { select: { id: true, name: true } },
  user: { select: { fullName: true, email: true } },
} satisfies Prisma.CandidateProfileSelect;

type ProfileRow = Prisma.CandidateProfileGetPayload<{
  select: typeof profileSelect;
}>;

function toResponse(row: ProfileRow): CandidateProfileResponse {
  // Un nom sans fichier (anciennes données de démonstration) n'est pas un CV.
  const hasCv =
    row.cvFileKey !== null &&
    row.cvFileName !== null &&
    row.cvFileSize !== null &&
    row.cvUploadedAt !== null;
  return {
    fullName: row.user.fullName,
    email: row.user.email,
    city: row.city,
    education: row.education,
    bio: row.bio,
    skills: row.skills,
    cv: hasCv
      ? {
          fileName: row.cvFileName!,
          size: row.cvFileSize!,
          uploadedAt: row.cvUploadedAt!.toISOString(),
        }
      : null,
  };
}

const noProfile = () =>
  apiError(
    403,
    APPLICATION_ERROR_CODES.noCandidateProfile,
    'Aucun profil candidat n’est associé à ce compte.',
  );

@Injectable()
export class CandidateProfileService {
  private readonly logger = new Logger(CandidateProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CvStorage,
  ) {}

  private async findRow(userId: string): Promise<ProfileRow> {
    const row = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });
    if (!row) throw noProfile();
    return row;
  }

  async get(userId: string): Promise<CandidateProfileResponse> {
    return toResponse(await this.findRow(userId));
  }

  /** Modifie les champs envoyés ; le nom complet est enregistré sur le compte. */
  async update(
    userId: string,
    dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfileResponse> {
    const profile = await this.findRow(userId);
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
        select: { id: true },
      });
      if (!city) {
        throw apiError(400, VALIDATION_FAILED, null, [
          { field: 'cityId', message: CV_MESSAGES.unknownCity },
        ]);
      }
    }
    const row = await this.prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        // Relation « city » (et non la colonne cityId) : Prisma ne permet pas de
        // mélanger colonnes de liaison et mise à jour imbriquée du compte (user).
        ...(dto.cityId !== undefined && {
          city: dto.cityId
            ? { connect: { id: dto.cityId } }
            : { disconnect: true },
        }),
        ...(dto.education !== undefined && { education: dto.education }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.skills !== undefined && { skills: dto.skills }),
        ...(dto.fullName !== undefined && {
          user: { update: { fullName: dto.fullName } },
        }),
      },
      select: profileSelect,
    });
    return toResponse(row);
  }

  /**
   * Dépose ou remplace le CV. Le fichier est vérifié (vrai PDF, 5 Mo au plus),
   * enregistré sous un nouveau nom, puis le profil est mis à jour. L'ancien
   * fichier n'est supprimé que si aucune candidature ne l'a transmis.
   */
  async uploadCv(
    userId: string,
    file: UploadedFile | undefined,
  ): Promise<CandidateProfileResponse> {
    if (!file || file.size === 0) {
      throw apiError(400, CV_ERROR_CODES.cvRequired, CV_MESSAGES.cvRequired);
    }
    if (file.size > CV_MAX_BYTES) {
      throw apiError(413, CV_ERROR_CODES.cvTooLarge, CV_MESSAGES.cvTooLarge);
    }
    if (!isPdf(file.buffer)) {
      throw apiError(400, CV_ERROR_CODES.cvNotPdf, CV_MESSAGES.cvNotPdf);
    }
    const key = await this.storage.save(file.buffer);
    return this.replaceCv(userId, {
      cvFileKey: key,
      cvFileName: safeFileName(file.originalname),
      cvFileSize: file.size,
      cvUploadedAt: new Date(),
    });
  }

  /** Retire le CV du profil (les candidatures déjà envoyées gardent le leur). */
  async deleteCv(userId: string): Promise<CandidateProfileResponse> {
    return this.replaceCv(userId, {
      cvFileKey: null,
      cvFileName: null,
      cvFileSize: null,
      cvUploadedAt: null,
    });
  }

  private async replaceCv(
    userId: string,
    data: Pick<
      ProfileRow,
      'cvFileKey' | 'cvFileName' | 'cvFileSize' | 'cvUploadedAt'
    >,
  ): Promise<CandidateProfileResponse> {
    const { row, previousKey } = await this.prisma
      .$transaction(async (tx) => {
        // Sérialise les changements de CV et attend les candidatures en cours.
        const [profile] = await tx.$queryRaw<
          { id: string; cvFileKey: string | null }[]
        >`
          SELECT "id", "cvFileKey"
          FROM "CandidateProfile"
          WHERE "userId" = ${userId}::uuid
          FOR NO KEY UPDATE`;
        if (!profile) throw noProfile();
        const row = await tx.candidateProfile.update({
          where: { id: profile.id },
          data,
          select: profileSelect,
        });
        return { row, previousKey: profile.cvFileKey };
      })
      .catch(async (error: unknown) => {
        await this.removeIfUnused(data.cvFileKey);
        throw error;
      });
    await this.removeIfUnused(previousKey);
    return toResponse(row);
  }

  async downloadOwnCv(userId: string): Promise<CvDownload> {
    const profile = await this.findRow(userId);
    if (!profile.cvFileKey || !profile.cvFileName) {
      throw apiError(404, CV_ERROR_CODES.cvNotFound, CV_MESSAGES.cvNotFound);
    }
    return this.readFile(profile.cvFileKey, profile.cvFileName);
  }

  /** Lit un fichier ; s'il a disparu du disque, 404 plutôt qu'une erreur 500. */
  async readFile(key: string, fileName: string): Promise<CvDownload> {
    try {
      return { fileName, content: await this.storage.read(key) };
    } catch (error) {
      this.logger.warn(
        `CV introuvable sur le disque (${key}) : ${String(error)}`,
      );
      throw apiError(404, CV_ERROR_CODES.cvNotFound, CV_MESSAGES.cvNotFound);
    }
  }

  /** Supprime un ancien fichier, sauf s'il est encore joint à une candidature. */
  private async removeIfUnused(key: string | null): Promise<void> {
    if (!key) return;
    try {
      const [profile, application] = await Promise.all([
        this.prisma.candidateProfile.findFirst({
          where: { cvFileKey: key },
          select: { id: true },
        }),
        this.prisma.application.findFirst({
          where: { cvFileKey: key },
          select: { id: true },
        }),
      ]);
      if (!profile && !application) await this.storage.remove(key);
    } catch (error) {
      this.logger.warn(
        `Impossible de nettoyer le CV (${key}) : ${String(error)}`,
      );
    }
  }
}
