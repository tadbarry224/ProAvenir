/**
 * Propose d'enregistrer un fichier reçu de l'API (ex. un CV en PDF).
 *
 * Le fichier est téléchargé avec le jeton de session (en-tête Authorization),
 * donc un simple lien <a href> vers l'API ne suffit pas : on crée une adresse
 * temporaire vers le contenu reçu, on clique dessus, puis on la libère.
 */
export function saveFile(content: Blob, fileName: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
