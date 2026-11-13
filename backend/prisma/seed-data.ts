/**
 * Données de départ de ProAvenir, reprises des données fictives du frontend
 * (src/data/mockOffers.ts, mockCompanies.ts, mockApplications.ts, mockAdmin.ts).
 *
 * Identifiants FIXES : relancer le script met à jour les mêmes lignes au lieu
 * de créer des doublons. Préfixe par type pour les reconnaître :
 *   1… utilisateurs · 2… entreprises · 3… offres · 4… candidatures
 *   5… profils candidats · 6… membres d'entreprise
 *
 * Sécurité : AUCUN mot de passe. Les comptes de démonstration ont
 * passwordHash = null et ne peuvent donc pas se connecter. Les e-mails utilisent
 * le domaine réservé « .test » (RFC 2606), qui ne peut appartenir à personne.
 */

const uuid = (prefix: number, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const cities = [
  { id: 'conakry', name: 'Conakry' },
  { id: 'kindia', name: 'Kindia' },
  { id: 'labe', name: 'Labé' },
  { id: 'boke', name: 'Boké' },
];

export const domains = [
  { id: 'marketing', name: 'Marketing' },
  { id: 'informatique', name: 'Informatique' },
  { id: 'commerce', name: 'Commerce' },
  { id: 'finance', name: 'Finance' },
  { id: 'ressources-humaines', name: 'Ressources humaines' },
  { id: 'logistique', name: 'Logistique' },
];

// --- Utilisateurs ------------------------------------------------------------

export const ADMIN_ID = uuid(1, 1);
export const MARIAMA_ID = uuid(1, 2);
export const ABDOULAYE_ID = uuid(1, 3);

export const users = [
  {
    id: ADMIN_ID,
    email: 'admin@proavenir.test',
    fullName: 'Administrateur ProAvenir',
    role: 'ADMIN' as const,
  },
  {
    id: MARIAMA_ID,
    email: 'mariama.diallo@proavenir.test',
    fullName: 'Mariama Diallo',
    role: 'CANDIDATE' as const,
  },
  {
    id: ABDOULAYE_ID,
    email: 'abdoulaye.bah@proavenir.test',
    fullName: 'Abdoulaye Bah',
    role: 'CANDIDATE' as const,
  },
];

// --- Entreprises (6 approuvées avec offres + 3 en attente, vues par l'admin) ---

type CompanySeed = {
  n: number;
  slug: string;
  name: string;
  logoColor: string;
  status: 'APPROVED' | 'PENDING';
  createdAt: string;
  sector?: string;
  cityId?: string;
  description?: string;
  contactEmail?: string;
  phone?: string;
};

const APPROVED_AT = '2026-11-01T12:00:00.000Z';

const companySeeds: CompanySeed[] = [
  {
    n: 1,
    slug: 'kamsar-solutions',
    name: 'Kamsar Solutions',
    logoColor: 'blue',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
    // Profil complet (valeurs de l'écran « Profil entreprise »)
    sector: 'Services professionnels',
    cityId: 'conakry',
    description:
      'Cabinet guinéen spécialisé dans l’accompagnement des organisations et le développement de projets.',
    contactEmail: 'recrutement@kamsar-solutions.test',
    phone: '+224 600 00 00 00',
  },
  {
    n: 2,
    slug: 'nimba-digital',
    name: 'Nimba Digital',
    logoColor: 'green',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
  },
  {
    n: 3,
    slug: 'conakry-services',
    name: 'Conakry Services',
    logoColor: 'orange',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
  },
  {
    n: 4,
    slug: 'fouta-conseil',
    name: 'Fouta Conseil',
    logoColor: 'violet',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
  },
  {
    n: 5,
    slug: 'sogue-industrie',
    name: 'Sogué Industrie',
    logoColor: 'teal',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
  },
  {
    n: 6,
    slug: 'boke-distribution',
    name: 'Boké Distribution',
    logoColor: 'navy',
    status: 'APPROVED',
    createdAt: '2026-10-15T12:00:00.000Z',
  },
  // En attente de vérification (écran « Entreprises à vérifier » de l'admin)
  {
    n: 7,
    slug: 'horoya-conseil',
    name: 'Horoya Conseil',
    logoColor: 'blue',
    status: 'PENDING',
    createdAt: '2026-12-15T12:00:00.000Z',
    sector: 'Conseil',
    cityId: 'conakry',
  },
  {
    n: 8,
    slug: 'kindia-agro-services',
    name: 'Kindia Agro Services',
    logoColor: 'blue',
    status: 'PENDING',
    createdAt: '2026-12-14T12:00:00.000Z',
    sector: 'Agriculture',
    cityId: 'kindia',
  },
  {
    n: 9,
    slug: 'boke-transit',
    name: 'Boké Transit',
    logoColor: 'blue',
    status: 'PENDING',
    createdAt: '2026-12-12T12:00:00.000Z',
    sector: 'Logistique',
    cityId: 'boke',
  },
];

export const companyId = (n: number) => uuid(2, n);
export const companyOwnerId = (n: number) => uuid(1, 10 + n);

export const companies = companySeeds.map(({ n, slug: _slug, ...company }) => ({
  id: companyId(n),
  ...company,
  reviewedAt: company.status === 'APPROVED' ? APPROVED_AT : null,
}));

/** Un compte principal (OWNER) par entreprise. */
export const companyOwners = companySeeds.map(({ n, slug, name }) => ({
  user: {
    id: companyOwnerId(n),
    email: `recrutement.${slug}@proavenir.test`,
    fullName: `Recrutement ${name}`,
    role: 'COMPANY' as const,
  },
  member: {
    id: uuid(6, n),
    companyId: companyId(n),
    userId: companyOwnerId(n),
    role: 'OWNER' as const,
  },
}));

// --- Profils candidats ----------------------------------------------------------

export const MARIAMA_PROFILE_ID = uuid(5, 1);
export const ABDOULAYE_PROFILE_ID = uuid(5, 2);

export const candidateProfiles = [
  {
    id: MARIAMA_PROFILE_ID,
    userId: MARIAMA_ID,
    cityId: 'conakry',
    education: 'Licence en Communication — Université de Sonfonia',
    bio: 'Jeune diplômée passionnée par la communication digitale et les projets à impact.',
    skills: ['Communication', 'Réseaux sociaux', 'Canva', 'Excel'],
    cvFileName: 'CV_Mariama_Diallo.pdf', // nom affiché ; aucun fichier stocké (phase B6)
  },
  { id: ABDOULAYE_PROFILE_ID, userId: ABDOULAYE_ID, skills: [] as string[] },
];

// --- Offres (toutes publiées, comme dans le frontend) ---------------------------

export const offerId = (n: number) => uuid(3, n);

export const offers = [
  {
    id: offerId(1),
    companyId: companyId(1),
    title: 'Assistant·e marketing digital',
    type: 'INTERNSHIP' as const,
    // Libellé du frontend : « Stage · 6 mois »
    contractType: 'INTERNSHIP' as const,
    workSchedule: null,
    duration: '6 mois',
    cityId: 'conakry',
    domainId: 'marketing',
    publishedAt: '2026-12-08T12:00:00.000Z',
    deadline: '2026-12-28',
    description:
      'Rejoignez une équipe dynamique pour contribuer à la stratégie digitale, produire des contenus adaptés aux audiences locales et suivre les performances de nos campagnes. Vous travaillerez aux côtés de l’équipe commerciale sur des projets concrets.',
    skills: ['Réseaux sociaux', 'Canva', 'Communication', 'Analyse'],
    featured: true,
  },
  {
    id: offerId(2),
    companyId: companyId(2),
    title: 'Développeur·se web junior',
    type: 'JOB' as const,
    // Libellé du frontend : « CDI · Temps plein »
    contractType: 'CDI' as const,
    workSchedule: 'FULL_TIME' as const,
    duration: null,
    cityId: 'conakry',
    domainId: 'informatique',
    publishedAt: '2026-12-07T12:00:00.000Z',
    deadline: '2027-01-04',
    description:
      'Vous participerez au développement et à la maintenance d’applications web utiles aux entreprises guinéennes. Vous serez accompagné·e par un développeur senior et contribuerez à toutes les étapes du produit.',
    skills: ['React', 'TypeScript', 'Git', 'Esprit d’équipe'],
    featured: false,
  },
  {
    id: offerId(3),
    companyId: companyId(3),
    title: 'Chargé·e de clientèle',
    type: 'JOB' as const,
    // Libellé du frontend : « CDD · 12 mois »
    contractType: 'CDD' as const,
    workSchedule: null,
    duration: '12 mois',
    cityId: 'conakry',
    domainId: 'commerce',
    publishedAt: '2026-12-01T12:00:00.000Z',
    deadline: '2027-01-10',
    description:
      'Vous accueillez et accompagnez les clients, identifiez leurs besoins et assurez un suivi rigoureux des demandes. Une excellente expression en français et le sens du service sont essentiels.',
    skills: ['Relation client', 'Organisation', 'Français', 'Pack Office'],
    featured: false,
  },
  {
    id: offerId(4),
    companyId: companyId(4),
    title: 'Stagiaire comptable',
    type: 'INTERNSHIP' as const,
    // Libellé du frontend : « Stage · 3 mois »
    contractType: 'INTERNSHIP' as const,
    workSchedule: null,
    duration: '3 mois',
    cityId: 'labe',
    domainId: 'finance',
    publishedAt: '2026-11-28T12:00:00.000Z',
    deadline: '2027-01-15',
    description:
      'Sous la supervision du responsable administratif, vous contribuerez à la saisie des pièces comptables, au classement des dossiers et à la préparation des états de rapprochement.',
    skills: ['Comptabilité', 'Excel', 'Rigueur', 'Confidentialité'],
    featured: false,
  },
  {
    id: offerId(5),
    companyId: companyId(5),
    title: 'Assistant·e ressources humaines',
    type: 'JOB' as const,
    // Libellé du frontend : « CDD · 6 mois »
    contractType: 'CDD' as const,
    workSchedule: null,
    duration: '6 mois',
    cityId: 'kindia',
    domainId: 'ressources-humaines',
    publishedAt: '2026-11-25T12:00:00.000Z',
    deadline: '2027-01-18',
    description:
      'Vous appuierez l’équipe RH dans la gestion administrative des collaborateurs, l’accueil des nouvelles recrues et le suivi des dossiers de formation.',
    skills: ['Administration', 'Excel', 'Écoute', 'Discrétion'],
    featured: false,
  },
  {
    id: offerId(6),
    companyId: companyId(6),
    title: 'Agent·e logistique',
    type: 'JOB' as const,
    // Libellé du frontend : « CDI · Temps plein »
    contractType: 'CDI' as const,
    workSchedule: 'FULL_TIME' as const,
    duration: null,
    cityId: 'boke',
    domainId: 'logistique',
    publishedAt: '2026-11-20T12:00:00.000Z',
    deadline: '2027-01-20',
    description:
      'Vous assurerez la réception, le contrôle et le suivi des marchandises, ainsi que la mise à jour des outils de gestion de stock.',
    skills: ['Gestion de stock', 'Ponctualité', 'Excel', 'Travail en équipe'],
    featured: false,
  },
];

// --- Candidatures ------------------------------------------------------------------
// Mariama : ses 3 candidatures (espace candidat). Abdoulaye : 1 candidature (espace
// entreprise). La candidature de Fatoumata Camara à « Commercial·e terrain » n'est pas
// reprise : cette offre n'existe pas dans les données fictives du frontend.

export const applications = [
  {
    id: uuid(4, 1),
    offerId: offerId(1),
    candidateId: MARIAMA_PROFILE_ID,
    status: 'IN_REVIEW' as const,
    createdAt: '2026-12-12T12:00:00.000Z',
    cvFileName: 'CV_Mariama_Diallo.pdf',
  },
  {
    id: uuid(4, 2),
    offerId: offerId(2),
    candidateId: MARIAMA_PROFILE_ID,
    status: 'SHORTLISTED' as const,
    createdAt: '2026-12-08T12:00:00.000Z',
    cvFileName: 'CV_Mariama_Diallo.pdf',
  },
  {
    id: uuid(4, 3),
    offerId: offerId(3),
    candidateId: MARIAMA_PROFILE_ID,
    status: 'SENT' as const,
    createdAt: '2026-12-01T12:00:00.000Z',
    cvFileName: 'CV_Mariama_Diallo.pdf',
  },
  {
    id: uuid(4, 4),
    offerId: offerId(1),
    candidateId: ABDOULAYE_PROFILE_ID,
    status: 'SENT' as const,
    createdAt: '2026-12-11T12:00:00.000Z',
  },
];
