/**
 * Ce que l'API renvoie pour une offre publique, et comment on l'obtient.
 *
 * Sécurité : la requête ne lit QUE les colonnes listées dans `publicOfferSelect`.
 * Aucune donnée de compte (e-mail, mot de passe…), aucun contact ni statut
 * d'entreprise, aucun identifiant interne d'entreprise ne peut donc sortir par erreur.
 */
import { Prisma } from '../generated/prisma/client.js';
import type {
  ContractType,
  OfferType,
  WorkSchedule,
} from '../generated/prisma/enums.js';
import type { ReferenceItem } from '../reference/reference.service.js';

export interface PublicOffer {
  id: string;
  title: string;
  type: OfferType;
  contractType: ContractType | null;
  workSchedule: WorkSchedule | null;
  duration: string | null;
  city: ReferenceItem;
  domain: ReferenceItem;
  description: string;
  /** Date limite incluse, "AAAA-MM-JJ". */
  deadline: string;
  skills: string[];
  featured: boolean;
  /** Date ISO complète de publication. */
  publishedAt: string;
  company: { name: string; logoColor: string };
}

export interface PublicOffersResponse {
  data: PublicOffer[];
  meta: {
    total: number;
    /** Date du jour (Conakry) utilisée pour exclure les offres expirées. */
    today: string;
  };
}

/**
 * Règle de visibilité publique, définie une seule fois :
 * - offre publiée (ni brouillon, ni clôturée) ;
 * - date limite aujourd'hui ou plus tard (le jour même reste valable) ;
 * - entreprise validée par l'administration.
 */
export function publicOffersWhere(today: string): Prisma.OfferWhereInput {
  return {
    status: 'PUBLISHED',
    deadline: { gte: new Date(today) },
    company: { status: 'APPROVED' },
  };
}

export const publicOfferSelect = {
  id: true,
  title: true,
  type: true,
  contractType: true,
  workSchedule: true,
  duration: true,
  description: true,
  deadline: true,
  skills: true,
  featured: true,
  publishedAt: true,
  city: { select: { id: true, name: true } },
  domain: { select: { id: true, name: true } },
  company: { select: { name: true, logoColor: true } },
} satisfies Prisma.OfferSelect;

type PublicOfferRow = Prisma.OfferGetPayload<{
  select: typeof publicOfferSelect;
}>;

/** Une colonne DATE arrive en Date à minuit UTC : on la renvoie en "AAAA-MM-JJ". */
const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export function toPublicOffer(row: PublicOfferRow): PublicOffer {
  // La règle publique et les contraintes CHECK garantissent ces deux dates.
  if (!row.deadline || !row.publishedAt) {
    throw new Error(`Offre publique incomplète : ${row.id}`);
  }
  return {
    ...row,
    deadline: toIsoDate(row.deadline),
    publishedAt: row.publishedAt.toISOString(),
  };
}
