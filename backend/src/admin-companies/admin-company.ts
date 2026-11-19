/**
 * Ce que l'API renvoie à l'administration pour une entreprise.
 *
 * Sécurité : seules les colonnes de `adminCompanySelect` sont lues. Aucune donnée
 * des comptes utilisateurs (e-mail, mot de passe, sessions) n'en fait partie.
 */
import { Prisma } from '../generated/prisma/client.js';
import type { CompanyStatus } from '../generated/prisma/enums.js';

export interface AdminCompany {
  id: string;
  name: string;
  sector: string | null;
  city: { id: string; name: string } | null;
  status: CompanyStatus;
  /** Motif montré à l'entreprise ; null sauf si elle est refusée. */
  rejectionReason: string | null;
  /** Date d'inscription (ISO complète). */
  createdAt: string;
  /** Date de la dernière décision de l'administration, null si jamais vérifiée. */
  reviewedAt: string | null;
  /** Nombre d'offres de l'entreprise (tous statuts). */
  offersCount: number;
}

export interface AdminCompaniesResponse {
  data: AdminCompany[];
  meta: { total: number; pending: number };
}

export const adminCompanySelect = {
  id: true,
  name: true,
  sector: true,
  city: { select: { id: true, name: true } },
  status: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
  _count: { select: { offers: true } },
} satisfies Prisma.CompanySelect;

type AdminCompanyRow = Prisma.CompanyGetPayload<{
  select: typeof adminCompanySelect;
}>;

export function toAdminCompany({
  _count,
  createdAt,
  reviewedAt,
  ...row
}: AdminCompanyRow): AdminCompany {
  return {
    ...row,
    createdAt: createdAt.toISOString(),
    reviewedAt: reviewedAt?.toISOString() ?? null,
    offersCount: _count.offers,
  };
}

/** Ordre d'affichage : entreprises en attente d'abord, puis les plus récentes. */
const STATUS_ORDER: Record<CompanyStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

export function byReviewPriority(a: AdminCompany, b: AdminCompany): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
