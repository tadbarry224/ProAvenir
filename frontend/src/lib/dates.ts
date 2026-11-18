/**
 * Fonctions utilitaires sur les dates, partagées par toute l'application.
 *
 * Convention : une date « seule » (sans heure) est un texte "AAAA-MM-JJ",
 * comme le renvoie <input type="date"> et comme la stockera PostgreSQL (type DATE).
 * Une date avec heure est une date ISO complète ("2026-12-08T12:00:00.000Z").
 */

/**
 * Date du jour au format "AAAA-MM-JJ", dans le fuseau horaire de l'utilisateur.
 * (On n'utilise pas `toISOString()`, qui donne la date en UTC et peut décaler d'un jour.)
 */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Vérifie qu'un texte est une vraie date "AAAA-MM-JJ" (refuse par exemple 2027-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Formate une date en français court : « 28 déc. 2026 ».
 * Accepte une date seule ("2026-12-28") ou une date ISO complète.
 * Une date seule est lue dans le fuseau local (sinon `new Date("2026-12-28")`
 * serait interprétée en UTC et pourrait afficher la veille).
 */
export function formatShortDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
