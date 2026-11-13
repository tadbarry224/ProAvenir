/**
 * Offres fictives de départ (anciennement le tableau `jobs` de App.tsx),
 * converties au format `Offer` : valeurs techniques (JOB/INTERNSHIP, PUBLISHED)
 * et dates ISO, comme le renverra plus tard l'API.
 *
 * Les heures sont fixées à midi UTC pour que le jour affiché reste le même
 * quel que soit le fuseau horaire du navigateur.
 */
import type { Offer } from "../types/offer";

export const mockOffers: Offer[] = [
  {
    id: 1,
    companyId: 1,
    status: "PUBLISHED",
    title: "Assistant·e marketing digital",
    city: "Conakry",
    domain: "Marketing",
    type: "INTERNSHIP",
    contractType: "INTERNSHIP", // « Stage · 6 mois »
    workSchedule: null,
    duration: "6 mois",
    createdAt: "2026-12-08T12:00:00.000Z",
    publishedAt: "2026-12-08T12:00:00.000Z",
    deadline: "2026-12-28",
    description:
      "Rejoignez une équipe dynamique pour contribuer à la stratégie digitale, produire des contenus adaptés aux audiences locales et suivre les performances de nos campagnes. Vous travaillerez aux côtés de l’équipe commerciale sur des projets concrets.",
    skills: ["Réseaux sociaux", "Canva", "Communication", "Analyse"],
    featured: true,
  },
  {
    id: 2,
    companyId: 2,
    status: "PUBLISHED",
    title: "Développeur·se web junior",
    city: "Conakry",
    domain: "Informatique",
    type: "JOB",
    contractType: "CDI", // « CDI · Temps plein »
    workSchedule: "FULL_TIME",
    duration: null,
    createdAt: "2026-12-07T12:00:00.000Z",
    publishedAt: "2026-12-07T12:00:00.000Z",
    deadline: "2027-01-04",
    description:
      "Vous participerez au développement et à la maintenance d’applications web utiles aux entreprises guinéennes. Vous serez accompagné·e par un développeur senior et contribuerez à toutes les étapes du produit.",
    skills: ["React", "TypeScript", "Git", "Esprit d’équipe"],
  },
  {
    id: 3,
    companyId: 3,
    status: "PUBLISHED",
    title: "Chargé·e de clientèle",
    city: "Conakry",
    domain: "Commerce",
    type: "JOB",
    contractType: "CDD", // « CDD · 12 mois »
    workSchedule: null,
    duration: "12 mois",
    createdAt: "2026-12-01T12:00:00.000Z",
    publishedAt: "2026-12-01T12:00:00.000Z",
    deadline: "2027-01-10",
    description:
      "Vous accueillez et accompagnez les clients, identifiez leurs besoins et assurez un suivi rigoureux des demandes. Une excellente expression en français et le sens du service sont essentiels.",
    skills: ["Relation client", "Organisation", "Français", "Pack Office"],
  },
  {
    id: 4,
    companyId: 4,
    status: "PUBLISHED",
    title: "Stagiaire comptable",
    city: "Labé",
    domain: "Finance",
    type: "INTERNSHIP",
    contractType: "INTERNSHIP", // « Stage · 3 mois »
    workSchedule: null,
    duration: "3 mois",
    createdAt: "2026-11-28T12:00:00.000Z",
    publishedAt: "2026-11-28T12:00:00.000Z",
    deadline: "2027-01-15",
    description:
      "Sous la supervision du responsable administratif, vous contribuerez à la saisie des pièces comptables, au classement des dossiers et à la préparation des états de rapprochement.",
    skills: ["Comptabilité", "Excel", "Rigueur", "Confidentialité"],
  },
  {
    id: 5,
    companyId: 5,
    status: "PUBLISHED",
    title: "Assistant·e ressources humaines",
    city: "Kindia",
    domain: "Ressources humaines",
    type: "JOB",
    contractType: "CDD", // « CDD · 6 mois »
    workSchedule: null,
    duration: "6 mois",
    createdAt: "2026-11-25T12:00:00.000Z",
    publishedAt: "2026-11-25T12:00:00.000Z",
    deadline: "2027-01-18",
    description:
      "Vous appuierez l’équipe RH dans la gestion administrative des collaborateurs, l’accueil des nouvelles recrues et le suivi des dossiers de formation.",
    skills: ["Administration", "Excel", "Écoute", "Discrétion"],
  },
  {
    id: 6,
    companyId: 6,
    status: "PUBLISHED",
    title: "Agent·e logistique",
    city: "Boké",
    domain: "Logistique",
    type: "JOB",
    contractType: "CDI", // « CDI · Temps plein »
    workSchedule: "FULL_TIME",
    duration: null,
    createdAt: "2026-11-20T12:00:00.000Z",
    publishedAt: "2026-11-20T12:00:00.000Z",
    deadline: "2027-01-20",
    description:
      "Vous assurerez la réception, le contrôle et le suivi des marchandises, ainsi que la mise à jour des outils de gestion de stock.",
    skills: ["Gestion de stock", "Ponctualité", "Excel", "Travail en équipe"],
  },
];
