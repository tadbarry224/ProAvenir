/**
 * Conversion d'une `Offer` (modèle de données) en `Job` (modèle d'affichage)
 * attendu par les composants publics existants : JobCard, JobLogo, JobDetails…
 *
 * Avantage : les composants d'affichage restent inchangés. Quand l'API renverra
 * des offres, il suffira de les passer dans cette même fonction.
 */
import { formatShortDate } from "../../lib/dates";
import { OFFER_TYPE_LABELS, type Company, type Job, type Offer } from "../../types/offer";

/** Initiales de secours si l'entreprise est inconnue : « Fouta Conseil » → « FC ». */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function toJobView(offer: Offer, company: Company | undefined): Job {
  const companyName = company?.name ?? "Entreprise";
  const typeLabel = OFFER_TYPE_LABELS[offer.type];
  return {
    id: offer.id,
    title: offer.title,
    company: companyName,
    initials: company?.initials ?? initialsOf(companyName),
    city: offer.city,
    domain: offer.domain,
    type: typeLabel,
    // Tant que le formulaire n'a pas de champ contrat/durée, on affiche le type seul.
    contract: offer.contract ?? typeLabel,
    posted: `Publiée le ${formatShortDate(offer.publishedAt ?? offer.createdAt)}`,
    deadline: offer.deadline ? formatShortDate(offer.deadline) : "",
    description: offer.description,
    skills: offer.skills,
    color: company?.logoColor ?? "blue",
    featured: offer.featured,
  };
}
