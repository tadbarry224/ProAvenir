/**
 * Conversion d'une `Offer` (modèle de données) en `Job` (modèle d'affichage)
 * attendu par les composants publics existants : JobCard, JobLogo, JobDetails…
 *
 * Avantage : les composants d'affichage restent inchangés. Quand l'API renverra
 * des offres, il suffira de les passer dans cette même fonction.
 */
import { OFFER_TYPE_LABELS, type Company, type Job, type Offer } from "../../types/offer.ts";

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
