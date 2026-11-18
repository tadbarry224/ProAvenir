/**
 * Ce que l'API renvoie à une entreprise pour SES offres (espace « Mes offres »).
 *
 * Contrairement à l'API publique, on inclut les brouillons, les offres clôturées et
 * expirées, ainsi que le nombre réel de candidatures. Sécurité : seules les colonnes
 * listées dans `companyOfferSelect` sont lues ; aucune donnée de compte, aucun
 * contact, aucune information sur les candidats n'est renvoyée (seulement un nombre).
 */
import { toIsoDate } from '../common/dates.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CompanyStatus,
  ContractType,
  OfferStatus,
  OfferType,
  WorkSchedule,
} from '../generated/prisma/enums.js';
import type { ReferenceItem } from '../reference/reference.service.js';
import type { CurrentCompany } from './company-membership.service.js';

export interface CompanyOffer {
  id: string;
  title: string;
  type: OfferType;
  contractType: ContractType | null;
  workSchedule: WorkSchedule | null;
  duration: string | null;
  status: OfferStatus;
  city: ReferenceItem;
  domain: ReferenceItem;
  description: string;
  /** Date limite incluse "AAAA-MM-JJ" ; null pour un brouillon qui n'en a pas encore. */
  deadline: string | null;
  skills: string[];
  /** Mise en avant : décidée par l'administration, lecture seule pour l'entreprise. */
  featured: boolean;
  /** Dates ISO complètes ; null si l'offre n'a jamais été publiée / clôturée. */
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Nombre réel de candidatures reçues (PostgreSQL). */
  applicationsCount: number;
  /**
   * Vrai si l'offre apparaît en ce moment dans GET /api/offers (même règle que
   * l'API publique : publiée, date limite non dépassée, entreprise validée).
   */
  publiclyVisible: boolean;
}

export interface CompanyOffersResponse {
  data: CompanyOffer[];
  meta: {
    total: number;
    /** Date du jour (Conakry) utilisée pour calculer l'expiration. */
    today: string;
    /** L'entreprise connectée : son statut décide de ce qu'elle peut faire. */
    company: { name: string; status: CompanyStatus };
  };
}

export const companyOfferSelect = {
  id: true,
  title: true,
  type: true,
  contractType: true,
  workSchedule: true,
  duration: true,
  status: true,
  description: true,
  deadline: true,
  skills: true,
  featured: true,
  publishedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  city: { select: { id: true, name: true } },
  domain: { select: { id: true, name: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.OfferSelect;

export type CompanyOfferRow = Prisma.OfferGetPayload<{
  select: typeof companyOfferSelect;
}>;

/** Ordre d'affichage : les plus récentes d'abord (comme le frontend aujourd'hui). */
export const companyOffersOrderBy = [
  { createdAt: 'desc' },
  { id: 'asc' },
] satisfies Prisma.OfferOrderByWithRelationInput[];

/**
 * Même règle que publicOffersWhere (offers/public-offer.ts), appliquée à une
 * offre déjà chargée. `today` et `deadline` sont au format "AAAA-MM-JJ" : la
 * comparaison de textes suit donc l'ordre des dates.
 */
export function isPubliclyVisible(
  offer: { status: OfferStatus; deadline: string | null },
  companyStatus: CompanyStatus,
  today: string,
): boolean {
  return (
    companyStatus === 'APPROVED' &&
    offer.status === 'PUBLISHED' &&
    offer.deadline !== null &&
    offer.deadline >= today
  );
}

export function toCompanyOffer(
  row: CompanyOfferRow,
  company: Pick<CurrentCompany, 'status'>,
  today: string,
): CompanyOffer {
  const { _count, ...fields } = row;
  const deadline = row.deadline ? toIsoDate(row.deadline) : null;
  return {
    ...fields,
    deadline,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    applicationsCount: _count.applications,
    publiclyVisible: isPubliclyVisible(
      { status: row.status, deadline },
      company.status,
      today,
    ),
  };
}
