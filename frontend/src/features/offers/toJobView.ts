/**
 * Conversion d'une `Offer` (modèle de données) en `Job` (modèle d'affichage)
 * attendu par les composants publics existants : JobCard, JobLogo, JobDetails…
 *
 * Avantage : les composants d'affichage restent inchangés. Quand l'API renverra
 * des offres, il suffira de les passer dans cette même fonction.
 */
import { formatShortDate } from "../../lib/dates";
import {
  CONTRACT_TYPE_LABELS,
  OFFER_TYPE_LABELS,
  WORK_SCHEDULE_LABELS,
  type Company,
  type Job,
  type Offer,
} from "../../types/offer";
import type { PublicOffer } from "../../services/offersService";

/**
 * Libellé du contrat affiché sur les cartes et le détail d'une offre :
 * « CDI · Temps plein », « Stage · 6 mois », « CDD · 6 mois · Temps partiel ».
 * Sans détail de contrat, on affiche le type seul (« Emploi », « Stage »).
 * JobCard n'affiche que la première partie (« CDI », « Stage »).
 */
export function contractLabel(
  offer: Pick<Offer, "type" | "contractType" | "workSchedule" | "duration">,
): string {
  const parts = [
    offer.contractType ? CONTRACT_TYPE_LABELS[offer.contractType] : OFFER_TYPE_LABELS[offer.type],
    offer.duration?.trim() || null,
    offer.workSchedule ? WORK_SCHEDULE_LABELS[offer.workSchedule] : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Initiales de secours si l'entreprise est inconnue : « Fouta Conseil » → « FC ». */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Champs nécessaires à l'affichage. Une `Offer` (données locales de l'espace
 * entreprise) comme une offre de l'API (après `publicOfferToJob`) les fournissent.
 */
type OfferViewSource = Pick<
  Offer,
  | "title"
  | "type"
  | "contractType"
  | "workSchedule"
  | "duration"
  | "description"
  | "deadline"
  | "skills"
  | "featured"
  | "publishedAt"
> & { id: number | string; city: string; domain: string; createdAt?: string };

type CompanyView = Pick<Company, "name" | "logoColor"> & { initials?: string };

export function toJobView(offer: OfferViewSource, company: CompanyView | undefined): Job {
  const companyName = company?.name ?? "Entreprise";
  const typeLabel = OFFER_TYPE_LABELS[offer.type];
  return {
    id: String(offer.id),
    title: offer.title,
    company: companyName,
    initials: company?.initials ?? initialsOf(companyName),
    city: offer.city,
    domain: offer.domain,
    type: typeLabel,
    contract: contractLabel(offer),
    posted: `Publiée le ${formatShortDate(offer.publishedAt ?? offer.createdAt ?? "")}`,
    deadline: offer.deadline ? formatShortDate(offer.deadline) : "",
    description: offer.description,
    skills: offer.skills,
    color: company?.logoColor ?? "blue",
    featured: offer.featured,
  };
}

/**
 * Offre renvoyée par GET /api/offers → modèle d'affichage.
 * Les initiales du logo sont déduites du nom (« Nimba Digital » → « ND »).
 */
export function publicOfferToJob(offer: PublicOffer): Job {
  return toJobView({ ...offer, city: offer.city.name, domain: offer.domain.name }, offer.company);
}
