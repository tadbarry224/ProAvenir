/**
 * Règles du profil candidat et du CV, sous forme de fonctions pures (testables).
 */

/** 5 Mo, même limite que la contrainte CHECK de la base et que le frontend. */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_RULES = {
  fullNameMin: 2,
  fullNameMax: 100,
  educationMax: 200,
  bioMax: 1000,
  skillsMax: 20,
  skillMaxLength: 40,
  fileNameMax: 120,
} as const;

/**
 * Codes d'erreur STABLES des routes /candidates/me/profile et /…/cv :
 * - 400 VALIDATION_FAILED : champ du profil invalide (details par champ) ;
 * - 400 CV_REQUIRED : aucun fichier dans le champ « cv » ;
 * - 400 CV_NOT_PDF : le fichier n'est pas un vrai PDF ;
 * - 413 CV_TOO_LARGE : plus de 5 Mo ;
 * - 404 CV_NOT_FOUND : aucun CV à télécharger ;
 * - 403 NO_CANDIDATE_PROFILE : compte candidat sans profil.
 */
export const CV_ERROR_CODES = {
  cvRequired: 'CV_REQUIRED',
  cvNotPdf: 'CV_NOT_PDF',
  cvTooLarge: 'CV_TOO_LARGE',
  cvNotFound: 'CV_NOT_FOUND',
} as const;

export const CV_MESSAGES = {
  cvRequired: 'Choisissez un fichier PDF à envoyer.',
  cvNotPdf: 'Le CV doit être un fichier PDF.',
  cvTooLarge: 'Le CV ne doit pas dépasser 5 Mo.',
  cvNotFound: 'Aucun CV n’est disponible.',
  unknownCity: 'Choisissez une ville dans la liste.',
} as const;

/**
 * Vrai si le contenu est réellement un PDF : il commence par « %PDF- ».
 * On ne se fie ni à l'extension ni au type annoncé par le navigateur, que
 * n'importe qui peut falsifier.
 */
export function isPdf(content: Buffer): boolean {
  return content.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * Nom de fichier sûr pour l'affichage et le téléchargement :
 * - les navigateurs envoient le nom en UTF-8, que multer lit en latin1 : on le
 *   redécode (« CV_Aïssatou.pdf ») ;
 * - on garde seulement le nom (jamais un chemin), sans caractères de contrôle ni
 *   guillemets, 120 caractères au plus, toujours terminé par « .pdf ».
 */
export function safeFileName(original: string): string {
  const decoded = Buffer.from(original, 'latin1').toString('utf8');
  const name = decoded.includes('�') ? original : decoded;
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.pdf$/i, '');
  const stem = (cleaned || 'CV').slice(0, PROFILE_RULES.fileNameMax - 4).trim();
  return `${stem}.pdf`;
}
