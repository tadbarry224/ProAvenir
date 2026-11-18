/**
 * Une colonne PostgreSQL DATE (sans heure) arrive dans Prisma en Date à minuit UTC :
 * on la renvoie au format "AAAA-MM-JJ", comme les <input type="date"> du frontend.
 */
export const toIsoDate = (date: Date): string =>
  date.toISOString().slice(0, 10);
