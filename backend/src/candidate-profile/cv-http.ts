/**
 * Outils HTTP partagés pour les CV : options d'envoi (multer), conversion de
 * l'erreur « fichier trop gros » et réponse de téléchargement.
 */
import {
  Catch,
  PayloadTooLargeException,
  StreamableFile,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { apiError } from '../common/api-error.js';
import { CV_ERROR_CODES, CV_MAX_BYTES, CV_MESSAGES } from './cv-rules.js';
import type { CvDownload } from './candidate-profile.service.js';

/**
 * Options de multer pour le champ « cv » : fichier gardé en mémoire (5 Mo au plus,
 * un seul fichier), puis vérifié par le service avant d'être écrit sur le disque.
 */
export const CV_UPLOAD_OPTIONS = {
  limits: { fileSize: CV_MAX_BYTES, files: 1, fields: 0 },
};

/**
 * multer refuse lui-même un fichier de plus de 5 Mo (413, message en anglais) :
 * on renvoie à la place notre format d'erreur, avec un code stable et un message
 * en français.
 */
@Catch(PayloadTooLargeException)
export class CvTooLargeFilter implements ExceptionFilter {
  catch(exception: PayloadTooLargeException, host: ArgumentsHost) {
    const body = exception.getResponse() as { code?: string };
    const error = body.code
      ? exception
      : apiError(413, CV_ERROR_CODES.cvTooLarge, CV_MESSAGES.cvTooLarge);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(413)
      .json(error.getResponse());
  }
}

/** Nom ASCII de secours pour les anciens navigateurs (« CV_Aïssatou.pdf » → « CV_A_ssatou.pdf »). */
const asciiName = (name: string) => name.replace(/[^\x20-\x7e]|["\\]/g, '_');

/**
 * Réponse de téléchargement d'un PDF :
 * - `attachment` : le navigateur l'enregistre au lieu de l'exécuter dans la page ;
 * - `nosniff` : il ne devine pas un autre type ;
 * - `no-store` : un CV (donnée personnelle) n'est pas gardé en cache.
 */
export function pdfDownload(
  download: CvDownload,
  res: Response,
): StreamableFile {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(download.content, {
    type: 'application/pdf',
    length: download.content.length,
    disposition: `attachment; filename="${asciiName(download.fileName)}"; filename*=UTF-8''${encodeURIComponent(download.fileName)}`,
  });
}
