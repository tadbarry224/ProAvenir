import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CvStorage } from './cv-storage.service.js';

describe('CvStorage', () => {
  let directory: string;
  let storage: CvStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'proavenir-cv-'));
    storage = new CvStorage(join(directory, 'cvs'));
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('enregistre sous un nom choisi par le serveur, relit puis supprime', async () => {
    const content = Buffer.from('%PDF-1.4 test');
    const key = await storage.save(content);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readdir(join(directory, 'cvs'))).toEqual([`${key}.pdf`]);
    expect(await storage.read(key)).toEqual(content);

    await storage.remove(key);
    await storage.remove(key); // déjà supprimé : pas d'erreur
    expect(await readdir(join(directory, 'cvs'))).toEqual([]);
  });

  it('refuse une clé qui ne vient pas du serveur (aucun chemin arbitraire)', async () => {
    for (const key of ['../secret', 'abc', '../../.env']) {
      await expect(storage.read(key)).rejects.toThrow(
        'Clé de fichier invalide.',
      );
      await expect(storage.remove(key)).rejects.toThrow(
        'Clé de fichier invalide.',
      );
    }
  });
});
