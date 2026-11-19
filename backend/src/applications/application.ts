/**
 * Ce que l'API renvoie pour une candidature, côté candidat et côté entreprise.
 *
 * Sécurité : seules les colonnes des `select` ci-dessous sont lues.
 * - Le candidat voit l'offre (titre, entreprise, ville) et son statut, jamais les
 *   données internes de l'entreprise.
 * - L'entreprise voit le candidat QUI LUI A ÉCRIT : nom, e-mail (pour le
 *   recontacter), ville, formation, compétences et message. Jamais son mot de
 *   passe, ses sessions ni ses autres candidatures.
 */
import { Prisma } from '../generated/prisma/client.js';
import type {
  ApplicationStatus,
  OfferType,
} from '../generated/prisma/enums.js';
import { toIsoDate } from '../common/dates.js';
import { isPubliclyVisible } from '../company-offers/company-offer.js';

type Reference = { id: string; name: string };

/** Candidature vue par le candidat (« Mes candidatures »). */
export interface CandidateApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  /** Dates ISO complètes : dépôt, puis dernière mise à jour du statut. */
  createdAt: string;
  updatedAt: string;
  offer: {
    id: string;
    title: string;
    type: OfferType;
    city: Reference;
    company: { name: string; logoColor: string };
    /** L'offre est encore en ligne (sinon son lien ne s'ouvre plus). */
    publiclyVisible: boolean;
  };
}

/** Candidature reçue par l'entreprise. */
export interface ReceivedApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  /** Nom du CV joint à la candidature (téléchargeable), null s’il n’y en a pas. */
  cvFileName: string | null;
  offer: { id: string; title: string };
  candidate: {
    fullName: string;
    email: string;
    city: Reference | null;
    education: string | null;
    skills: string[];
  };
}

export interface CandidateApplicationsResponse {
  data: CandidateApplication[];
  meta: { total: number };
}

export interface ReceivedApplicationsResponse {
  data: ReceivedApplication[];
  meta: { total: number };
}

/** Les plus récentes d'abord (identifiant en second critère : ordre stable). */
export const applicationsOrderBy = [
  { createdAt: 'desc' },
  { id: 'asc' },
] satisfies Prisma.ApplicationOrderByWithRelationInput[];

export const candidateApplicationSelect = {
  id: true,
  status: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  offer: {
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      deadline: true,
      city: { select: { id: true, name: true } },
      company: { select: { name: true, logoColor: true, status: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

export const receivedApplicationSelect = {
  id: true,
  status: true,
  message: true,
  createdAt: true,
  updatedAt: true,
  cvFileKey: true,
  cvFileName: true,
  offer: { select: { id: true, title: true } },
  candidate: {
    select: {
      education: true,
      skills: true,
      city: { select: { id: true, name: true } },
      user: { select: { fullName: true, email: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

type CandidateRow = Prisma.ApplicationGetPayload<{
  select: typeof candidateApplicationSelect;
}>;
type ReceivedRow = Prisma.ApplicationGetPayload<{
  select: typeof receivedApplicationSelect;
}>;

export function toCandidateApplication(
  row: CandidateRow,
  today: string,
): CandidateApplication {
  const { offer, createdAt, updatedAt, ...rest } = row;
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    offer: {
      id: offer.id,
      title: offer.title,
      type: offer.type,
      city: offer.city,
      company: { name: offer.company.name, logoColor: offer.company.logoColor },
      // Même règle que la liste publique (isPubliclyVisible ↔ publicOffersWhere).
      publiclyVisible: isPubliclyVisible(
        {
          status: offer.status,
          deadline: offer.deadline ? toIsoDate(offer.deadline) : null,
        },
        offer.company.status,
        today,
      ),
    },
  };
}

export function toReceivedApplication(row: ReceivedRow): ReceivedApplication {
  const { candidate, createdAt, updatedAt, cvFileKey, cvFileName, ...rest } =
    row;
  return {
    ...rest,
    // La clé du fichier reste interne ; un nom sans fichier n'est pas un CV.
    cvFileName: cvFileKey ? cvFileName : null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    candidate: {
      fullName: candidate.user.fullName,
      email: candidate.user.email,
      city: candidate.city,
      education: candidate.education,
      skills: candidate.skills,
    },
  };
}
