import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Clé d'un fichier : un UUID généré par le serveur (jamais un nom fourni par l'utilisateur). */
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Stockage des CV sur le disque, dans un dossier hors du code (CV_STORAGE_DIR).
 *
 * Sécurité :
 * - chaque fichier est rangé sous « <uuid>.pdf », un nom choisi par le serveur :
 *   le nom envoyé par l'utilisateur ne sert jamais de chemin (pas de « ../ ») ;
 * - la clé est revérifiée avant chaque accès (défense en profondeur) ;
 * - le dossier n'est pas servi publiquement : un CV ne sort que par les routes
 *   protégées (son candidat, ou l'entreprise qui a reçu la candidature).
 *
 * Classe simple (sans décorateur) : le module la crée avec le dossier configuré,
 * et les tests la remplacent par une instance sur un dossier temporaire.
 */
export class CvStorage {
  constructor(private readonly directory: string) {}

  private path(key: string): string {
    if (!KEY.test(key)) throw new Error('Clé de fichier invalide.');
    return join(this.directory, `${key}.pdf`);
  }

  /** Enregistre le contenu et renvoie sa nouvelle clé. */
  async save(content: Buffer): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const key = randomUUID();
    // `wx` : échoue si le fichier existait déjà (impossible en pratique avec un UUID).
    await writeFile(this.path(key), content, { flag: 'wx' });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  /** Supprime le fichier ; sans erreur s'il n'existe déjà plus. */
  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
