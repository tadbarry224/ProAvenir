import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  ListFilter,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import {
  OFFER_CITIES,
  OFFER_DISPLAY_STATUS_LABELS,
  OFFER_DOMAINS,
  type Company,
  type Job,
  type Offer,
  type OfferInput,
  type OfferStatus,
} from "./types/offer";
import type { Page } from "./types/navigation";
import type { RecruitApplication } from "./types/application";
import type { ModeratedOffer, PendingCompany } from "./types/admin";
import { getDisplayStatus, isPubliclyVisible } from "./features/offers/offerRules";
import { toJobView } from "./features/offers/toJobView";
import { useOffers } from "./features/offers/useOffers";
import { formatShortDate, todayIsoDate } from "./lib/dates";
import { DEMO_COMPANY_ID, findCompany } from "./data/mockCompanies";
import { candidateApplications, initialRecruitApplications } from "./data/mockApplications";
import { initialModeratedOffers, initialPendingCompanies } from "./data/mockAdmin";
import { StatCard } from "./components/ui/StatCard";
import { CardHeading } from "./components/ui/CardHeading";
import { JobLogo } from "./components/jobs/JobLogo";
import { JobCard } from "./components/jobs/JobCard";
import { MiniJob } from "./components/jobs/MiniJob";
import { Logo } from "./components/layout/Logo";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardTop } from "./components/layout/DashboardTop";
import { offerStatusStyle } from "./features/offers/offerStatusStyle";
import { ApplicationTable } from "./features/applications/ApplicationTable";
import { RecruitTable } from "./features/applications/RecruitTable";
import { PublishModal } from "./features/offers/PublishModal";

function Home({
  jobs,
  go,
  selectJob,
  setSearch,
  setCity,
}: {
  jobs: Job[]; // offres publiques uniquement (publiées et non expirées)
  go: (page: Page) => void;
  selectJob: (job: Job) => void;
  setSearch: (value: string) => void;
  setCity: (value: string) => void;
}) {
  const [heroSearch, setHeroSearch] = useState("");
  const [heroCity, setHeroCity] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(heroSearch);
    setCity(heroCity);
    go("jobs");
  };
  return (
    <>
      <main>
        <section className="hero-section overflow-hidden">
          <div className="hero-grid" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="page-shell relative grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> Votre avenir commence ici
              </span>
              <h1 className="font-display mt-6 max-w-3xl text-[43px] font-extrabold leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl">
                Le talent rencontre <span className="text-[#53d6aa]">l’opportunité.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Découvrez des stages et emplois en Guinée, postulez simplement et suivez chaque
                étape de votre candidature.
              </p>
              <form onSubmit={submit} className="search-panel mt-9">
                <label className="search-field">
                  <Search size={20} className="text-[#1768c4]" />
                  <span>
                    <small>Quel poste ?</small>
                    <input
                      value={heroSearch}
                      onChange={(e) => setHeroSearch(e.target.value)}
                      placeholder="Métier, compétence..."
                    />
                  </span>
                </label>
                <label className="search-field border-t sm:border-l sm:border-t-0">
                  <MapPin size={20} className="text-[#1768c4]" />
                  <span>
                    <small>Où ?</small>
                    <select value={heroCity} onChange={(e) => setHeroCity(e.target.value)}>
                      <option value="">Toute la Guinée</option>
                      <option>Conakry</option>
                      <option>Kindia</option>
                      <option>Labé</option>
                    </select>
                  </span>
                </label>
                <button className="btn-primary h-14 sm:h-[58px]" type="submit">
                  <Search size={18} /> Rechercher
                </button>
              </form>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={() => go("jobs")} className="btn-primary">
                  <BriefcaseBusiness size={17} /> Trouver un emploi
                </button>
                <button onClick={() => go("company")} className="btn-secondary">
                  <Plus size={17} /> Publier une offre
                </button>
              </div>
              <div className="hero-proof">
                <div>
                  <strong>6</strong>
                  <span>offres à découvrir</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>villes représentées</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>suivi transparent</span>
                </div>
              </div>
            </div>
            <div className="relative hidden min-h-[470px] lg:block">
              <div className="hero-visual">
                <div className="visual-head">
                  <span className="flex items-center gap-2 text-sm font-bold text-[#0c2340]">
                    <BriefcaseBusiness size={17} className="text-[#15966f]" /> Opportunités pour
                    vous
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                    NOUVEAU
                  </span>
                </div>
                {jobs.slice(0, 3).map((job, i) => (
                  <div className={`visual-job ${i === 1 ? "visual-job-active" : ""}`} key={job.id}>
                    <JobLogo job={job} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0c2340]">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {job.company} · {job.city}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-slate-300" />
                  </div>
                ))}
                <div className="mt-4 rounded-xl bg-[#f3faf7] p-4">
                  <div className="flex justify-between text-xs font-semibold text-[#126f55]">
                    <span>Profil complété</span>
                    <span>85%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-emerald-100">
                    <div className="h-full w-[85%] rounded-full bg-[#15966f]" />
                  </div>
                </div>
              </div>
              <div className="float-card float-card-top">
                <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check size={17} />
                </span>
                <span>
                  <b>Profil vérifié</b>
                  <small>Prêt à postuler</small>
                </span>
              </div>
              <div className="float-card float-card-bottom">
                <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-blue-700">
                  <UsersRound size={17} />
                </span>
                <span>
                  <b>+120 talents</b>
                  <small>sur la plateforme</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Dernières opportunités</span>
              <h2>Des offres qui vous ressemblent</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Des opportunités claires, accessibles et pensées pour faire avancer votre parcours.
              </p>
            </div>
            <button onClick={() => go("jobs")} className="text-link hidden sm:flex">
              Voir toutes les offres <ArrowRight size={16} />
            </button>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {jobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} onClick={() => selectJob(job)} />
            ))}
          </div>
          <button onClick={() => go("jobs")} className="btn-secondary mt-7 w-full sm:hidden">
            Voir toutes les offres
          </button>
        </section>

        <section className="bg-[#f5f8fb] py-16 sm:py-20">
          <div className="page-shell">
            <div className="text-center">
              <span className="section-kicker">Simple et transparent</span>
              <h2 className="section-title">Votre prochaine étape en 3 temps</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [
                  Search,
                  "01",
                  "Trouvez une offre",
                  "Recherchez par métier, domaine, ville ou type de contrat.",
                ],
                [
                  FileText,
                  "02",
                  "Postulez simplement",
                  "Complétez votre profil, ajoutez votre CV et envoyez votre candidature.",
                ],
                [
                  BarChart3,
                  "03",
                  "Suivez sa progression",
                  "Consultez le statut de chaque candidature depuis votre espace.",
                ],
              ].map(([Icon, num, title, text]) => {
                const IconComponent = Icon as typeof Search;
                return (
                  <div className="step-card" key={num as string}>
                    <span className="step-number">{num as string}</span>
                    <span className="step-icon">
                      <IconComponent size={23} />
                    </span>
                    <h3>{title as string}</h3>
                    <p>{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="cta-panel">
            <div className="relative z-10">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200">
                POUR LES ENTREPRISES
              </span>
              <h2 className="font-display mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
                Trouvez les talents qui feront avancer votre entreprise.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                Publiez vos offres et gérez toutes les candidatures depuis un espace unique et
                simple.
              </p>
              <button
                onClick={() => go("company")}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0c2340] transition hover:-translate-y-0.5"
              >
                Publier une offre <ArrowRight size={16} />
              </button>
            </div>
            <Building2 className="absolute -bottom-12 right-8 size-56 text-white/[0.04] sm:right-16 sm:size-72" />
          </div>
        </section>
      </main>
      <Footer go={go} />
    </>
  );
}

function JobsPage({
  jobs,
  search,
  setSearch,
  city,
  setCity,
  selectJob,
}: {
  jobs: Job[]; // offres publiques uniquement (publiées et non expirées)
  search: string;
  setSearch: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  selectJob: (job: Job) => void;
}) {
  const [draftSearch, setDraftSearch] = useState(search);
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const matchSearch = `${job.title} ${job.company} ${job.skills.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return (
          matchSearch &&
          (!city || job.city === city) &&
          (!domain || job.domain === domain) &&
          (!type || job.type === type)
        );
      }),
    [jobs, search, city, domain, type],
  );
  const filters = (
    <>
      <div className="filter-group">
        <label>Ville</label>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {OFFER_CITIES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Domaine</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">Tous les domaines</option>
          {OFFER_DOMAINS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Type d’opportunité</label>
        <div className="space-y-2">
          {["Stage", "Emploi"].map((x) => (
            <label key={x} className="check-row">
              <input
                type="checkbox"
                name="type"
                checked={type === x}
                onChange={() => setType(type === x ? "" : x)}
              />
              <span>{x}</span>
              <small>{jobs.filter((j) => j.type === x).length}</small>
            </label>
          ))}
        </div>
      </div>
      {(city || domain || type) && (
        <button
          onClick={() => {
            setCity("");
            setDomain("");
            setType("");
          }}
          className="w-full text-center text-xs font-bold text-[#1768c4]"
        >
          Réinitialiser les filtres
        </button>
      )}
    </>
  );
  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <section className="jobs-masthead py-11">
        <div className="page-shell">
          <span className="section-kicker">Explorez les opportunités</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">
            Trouvez l’offre faite pour vous
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            Explorez des stages et emplois adaptés à votre parcours en Guinée.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draftSearch);
            }}
            className="jobs-search mt-7 flex max-w-3xl gap-2 rounded-2xl border border-white/20 bg-white p-2"
          >
            <label className="flex flex-1 items-center gap-3 px-3">
              <Search size={19} className="text-slate-400" />
              <input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                className="w-full py-2 text-sm outline-none"
                placeholder="Poste, compétence ou entreprise..."
              />
            </label>
            <button type="submit" className="btn-primary px-5">
              <span className="hidden sm:inline">Rechercher</span>
              <Search size={17} className="sm:hidden" />
            </button>
          </form>
        </div>
      </section>
      <div className="page-shell grid gap-8 py-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:block">
          <div className="mb-6 flex items-center gap-2 font-bold text-[#0c2340]">
            <SlidersHorizontal size={17} /> Filtres
          </div>
          {filters}
        </aside>
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0c2340]">
                {filtered.length} offre{filtered.length !== 1 ? "s" : ""} disponible
                {filtered.length !== 1 ? "s" : ""}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {/* Date réelle utilisée pour masquer les offres expirées (voir offerRules). */}
                Données fictives — offres ouvertes au {formatShortDate(todayIsoDate())}
              </p>
            </div>
            <button onClick={() => setMobileFilters(true)} className="btn-secondary px-3 lg:hidden">
              <ListFilter size={17} /> Filtres
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => selectJob(job)} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={28} />
              <h3>Aucune offre trouvée</h3>
              <p>Essayez de modifier votre recherche ou vos filtres.</p>
            </div>
          )}
        </section>
      </div>
      {mobileFilters && (
        <div className="modal-backdrop">
          <div className="mobile-sheet">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold">Filtrer les offres</h3>
              <button onClick={() => setMobileFilters(false)} className="icon-button">
                <X size={19} />
              </button>
            </div>
            {filters}
            <button onClick={() => setMobileFilters(false)} className="btn-primary mt-4 w-full">
              Afficher {filtered.length} offre(s)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function JobDetails({
  job,
  go,
  applied,
  onApply,
}: {
  job: Job;
  go: (page: Page) => void;
  applied: boolean;
  onApply: () => void;
}) {
  const [modal, setModal] = useState(false);
  const apply = (e: FormEvent) => {
    e.preventDefault();
    onApply();
    setModal(false);
  };
  return (
    <main className="min-h-screen bg-[#f6f8fb] pb-16">
      <div className="page-shell py-6">
        <button onClick={() => go("jobs")} className="text-link">
          <ArrowLeft size={16} /> Retour aux offres
        </button>
      </div>
      <div className="page-shell grid items-start gap-7 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="job-detail-hero content-card p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <JobLogo job={job} large />
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <span className={`pill ${job.type === "Stage" ? "pill-green" : "pill-blue"}`}>
                    {job.type}
                  </span>
                  <span className="pill bg-slate-100 text-slate-600">{job.domain}</span>
                  <span className="pill bg-amber-50 text-amber-700">Donnée fictive</span>
                </div>
                <h1 className="font-display mt-3 text-2xl font-extrabold tracking-[-0.035em] text-[#0c2340] sm:text-3xl">
                  {job.title}
                </h1>
                <p className="mt-2 font-semibold text-slate-600">{job.company}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} />
                    {job.city}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BriefcaseBusiness size={15} />
                    {job.contract}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={15} />
                    {job.posted}
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="content-card p-6 sm:p-8">
            <h2 className="content-title">À propos de l’offre</h2>
            <p className="mt-4 leading-7 text-slate-600">{job.description}</p>
            <h2 className="content-title mt-8">Vos missions</h2>
            <ul className="detail-list">
              <li>
                Contribuer activement aux projets de l’équipe et proposer des solutions adaptées.
              </li>
              <li>
                Assurer un suivi régulier des activités et partager des comptes rendus clairs.
              </li>
              <li>Collaborer avec les différents interlocuteurs internes et externes.</li>
            </ul>
            <h2 className="content-title mt-8">Compétences recherchées</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span className="skill-tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <h2 className="content-title mt-8">Profil recherché</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Vous êtes motivé·e, rigoureux·se et souhaitez progresser dans un environnement
              professionnel stimulant. Une première expérience ou un projet académique pertinent
              sera apprécié.
            </p>
          </section>
        </div>
        <aside className="content-card sticky top-24 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Date limite</p>
          <p className="mt-2 flex items-center gap-2 font-bold text-[#0c2340]">
            <CalendarDays size={18} className="text-[#1768c4]" />
            {job.deadline}
          </p>
          <div className="my-5 h-px bg-slate-100" />
          {applied ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" />
              <p className="mt-2 text-sm font-bold text-emerald-800">Candidature envoyée</p>
              <p className="mt-1 text-xs text-emerald-700">
                Vous pouvez suivre son état depuis votre espace.
              </p>
            </div>
          ) : (
            <button onClick={() => setModal(true)} className="btn-primary w-full">
              Postuler maintenant <ArrowRight size={17} />
            </button>
          )}
          <button onClick={() => go("candidate")} className="btn-secondary mt-3 w-full">
            Voir mon profil
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            Votre CV sera visible uniquement par le recruteur concerné.
          </p>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <form onSubmit={apply} className="modal-card">
            <div className="flex items-start justify-between">
              <div>
                <span className="section-kicker">Candidature</span>
                <h2 className="mt-1 text-xl font-extrabold text-[#0c2340]">{job.title}</h2>
              </div>
              <button type="button" onClick={() => setModal(false)} className="icon-button">
                <X size={19} />
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <FileCheck2 className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">CV_Mariama_Diallo.pdf</p>
                  <p className="text-xs text-emerald-700">Votre CV actuel sera transmis</p>
                </div>
              </div>
            </div>
            <label className="form-label mt-5">
              Message au recruteur <span>(facultatif)</span>
              <textarea rows={4} placeholder="Présentez brièvement votre motivation..." />
            </label>
            <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <input required type="checkbox" className="mt-1 accent-[#15966f]" />
              Je confirme l’exactitude des informations de mon profil.
            </label>
            <button className="btn-primary mt-6 w-full">Envoyer ma candidature</button>
          </form>
        </div>
      )}
    </main>
  );
}

function AuthPage({ mode, go }: { mode: "login" | "register"; go: (page: Page) => void }) {
  const register = mode === "register";
  const [role, setRole] = useState<"candidate" | "company">("candidate");
  const [resetRequested, setResetRequested] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [authError, setAuthError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (register && password !== confirmation) {
      setAuthError("Les deux mots de passe doivent être identiques.");
      return;
    }
    setAuthError("");
    go(role === "candidate" ? "candidate" : "company");
  };
  return (
    <main className="auth-page">
      <div className="auth-brand-panel">
        <div className="relative z-10 max-w-md">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <GraduationCap size={25} />
          </span>
          <h1 className="font-display mt-8 text-4xl font-extrabold leading-tight tracking-[-0.04em]">
            {register ? "Construisez votre avenir professionnel." : "Heureux de vous revoir."}
          </h1>
          <p className="mt-5 leading-7 text-slate-300">
            {register
              ? "Rejoignez une communauté de talents et d’entreprises engagés pour l’emploi en Guinée."
              : "Retrouvez vos candidatures, vos offres et toutes vos opportunités en un seul endroit."}
          </p>
          <div className="mt-10 space-y-4">
            {[
              "Un profil professionnel clair",
              "Des opportunités adaptées",
              "Un suivi simple et transparent",
            ].map((x) => (
              <div className="flex items-center gap-3 text-sm font-semibold" key={x}>
                <span className="grid size-7 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check size={14} />
                </span>
                {x}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="w-full max-w-md">
          <Logo onClick={() => go("home")} />
          <h2 className="font-display mt-10 text-3xl font-extrabold tracking-[-0.04em] text-[#0c2340]">
            {register ? "Créer votre compte" : "Connexion"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {register
              ? "Quelques informations pour commencer."
              : "Saisissez vos identifiants pour continuer."}
          </p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">Je suis</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("candidate")}
                  className={`role-choice ${role === "candidate" ? "selected" : ""}`}
                >
                  <UserRound size={20} />
                  Candidat
                </button>
                <button
                  type="button"
                  onClick={() => setRole("company")}
                  className={`role-choice ${role === "company" ? "selected" : ""}`}
                >
                  <Building2 size={20} />
                  Entreprise
                </button>
              </div>
            </div>
            {register && (
              <label className="form-label">
                Nom complet
                <input
                  required
                  placeholder={role === "candidate" ? "Ex. Mariama Diallo" : "Ex. Ibrahima Camara"}
                />
              </label>
            )}
            {register && role === "company" && (
              <label className="form-label">
                Nom de l’entreprise
                <input required placeholder="Nom de votre organisation" />
              </label>
            )}
            <label className="form-label">
              Adresse e-mail
              <input required type="email" placeholder="vous@exemple.com" />
            </label>
            <label className="form-label">
              Mot de passe
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 caractères minimum"
              />
            </label>
            {register && (
              <label className="form-label">
                Confirmer le mot de passe
                <input
                  required
                  minLength={8}
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Saisissez à nouveau le mot de passe"
                />
              </label>
            )}
            {authError && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                {authError}
              </p>
            )}
            {!register && (
              <div className="flex justify-between text-xs">
                <label className="flex gap-2 text-slate-500">
                  <input type="checkbox" /> Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => setResetRequested(true)}
                  className="font-bold text-[#1768c4]"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
            {resetRequested && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
                Un lien de réinitialisation fictif a été envoyé à l’adresse indiquée.
              </p>
            )}
            <button className="btn-primary w-full py-3.5">
              {register ? "Créer mon compte" : "Se connecter"} <ArrowRight size={17} />
            </button>
          </form>
          {!register && (
            <div className="demo-access">
              <p>Accès rapide à la démonstration</p>
              <div>
                <button onClick={() => go("candidate")}>
                  <UserRound size={14} /> Candidat
                </button>
                <button onClick={() => go("company")}>
                  <Building2 size={14} /> Entreprise
                </button>
                <button onClick={() => go("admin")}>
                  <ShieldCheck size={14} /> Admin
                </button>
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-slate-500">
            {register ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              onClick={() => go(register ? "login" : "register")}
              className="font-bold text-[#1768c4]"
            >
              {register ? "Se connecter" : "Créer un compte"}
            </button>
          </p>
          <button
            onClick={() => go("home")}
            className="mx-auto mt-8 flex items-center gap-2 text-xs font-semibold text-slate-400"
          >
            <ArrowLeft size={14} /> Retour à l’accueil
          </button>
        </div>
      </div>
    </main>
  );
}

function CandidateDashboard({
  jobs,
  go,
  applicationStatus,
}: {
  jobs: Job[]; // offres publiques, pour les « Offres recommandées »
  go: (p: Page) => void;
  applicationStatus: string;
}) {
  const [active, setActive] = useState("Aperçu");
  const applications = candidateApplications.map((item, index) =>
    index === 0 ? { ...item, status: applicationStatus } : item,
  );
  return (
    <DashboardLayout area="candidate" go={go} active={active} setActive={setActive}>
      <DashboardTop
        title={active === "Aperçu" ? "Bonjour, Mariama" : active}
        subtitle={
          active === "Aperçu"
            ? "Voici où en sont vos démarches cette semaine."
            : "Gérez vos informations et votre parcours."
        }
        avatar="MD"
      />
      <div className="dashboard-content">
        {active === "Aperçu" && (
          <>
            <div className="stats-grid">
              <StatCard icon={FileText} value="3" label="Candidatures envoyées" tone="blue" />
              <StatCard
                icon={Eye}
                value={String(
                  applications.filter((item) => ["Envoyée", "En examen"].includes(item.status))
                    .length,
                )}
                label="En cours"
                tone="amber"
              />
              <StatCard
                icon={CheckCircle2}
                value={String(
                  applications.filter((item) =>
                    ["Présélectionnée", "Retenue"].includes(item.status),
                  ).length,
                )}
                label="Présélections"
                tone="green"
              />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_310px]">
              <div className="content-card overflow-hidden">
                <CardHeading
                  title="Candidatures récentes"
                  action="Tout voir"
                  onAction={() => setActive("Mes candidatures")}
                />
                <ApplicationTable items={applications} />
              </div>
              <div className="content-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-[#0c2340]">Votre profil</h2>
                  <span className="text-sm font-extrabold text-[#15966f]">85%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div className="h-full w-[85%] rounded-full bg-[#15966f]" />
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                    MD
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0c2340]">Mariama Diallo</p>
                    <p className="text-xs text-slate-400">Marketing & communication</p>
                  </div>
                </div>
                <button
                  onClick={() => setActive("Mon profil")}
                  className="btn-secondary mt-6 w-full"
                >
                  Compléter mon profil
                </button>
              </div>
            </div>
            <div className="content-card mt-6 overflow-hidden">
              <CardHeading
                title="Offres recommandées"
                action="Explorer"
                onAction={() => go("jobs")}
              />
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {jobs.slice(0, 2).map((job) => (
                  <MiniJob key={job.id} job={job} go={() => go("jobs")} />
                ))}
              </div>
            </div>
          </>
        )}
        {active === "Mon profil" && <CandidateProfile />}
        {active === "Mes candidatures" && (
          <div className="content-card overflow-hidden">
            <CardHeading title="Toutes mes candidatures" />
            <ApplicationTable items={applications} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CandidateProfile() {
  const [saved, setSaved] = useState(false);
  const [cvName, setCvName] = useState("CV_Mariama_Diallo.pdf");
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="content-card p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-label">
            Nom complet
            <input required defaultValue="Mariama Diallo" />
          </label>
          <label className="form-label">
            Ville
            <select required defaultValue="Conakry">
              <option>Conakry</option>
              <option>Labé</option>
              <option>Kindia</option>
            </select>
          </label>
          <label className="form-label sm:col-span-2">
            Formation
            <input required defaultValue="Licence en Communication — Université de Sonfonia" />
          </label>
          <label className="form-label sm:col-span-2">
            Présentation
            <textarea
              rows={4}
              defaultValue="Jeune diplômée passionnée par la communication digitale et les projets à impact."
            />
          </label>
          <label className="form-label sm:col-span-2">
            Compétences
            <input required defaultValue="Communication, Réseaux sociaux, Canva, Excel" />
          </label>
        </div>
        <button className="btn-primary mt-6">
          {saved ? <Check size={17} /> : null}
          {saved ? "Modifications enregistrées" : "Enregistrer les modifications"}
        </button>
      </form>
      <div className="content-card h-fit p-6">
        <h2 className="font-bold text-[#0c2340]">Mon CV</h2>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <FileText className="mx-auto text-[#1768c4]" />
          <p className="mt-3 truncate text-sm font-bold">{cvName}</p>
          <p className="mt-1 text-xs text-slate-400">Mis à jour le 10 déc. 2026</p>
        </div>
        <label className="btn-secondary mt-4 w-full cursor-pointer">
          <Upload size={16} /> Remplacer le CV
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setCvName(file.name);
            }}
          />
        </label>
        <p className="mt-3 text-center text-[11px] text-slate-400">PDF uniquement · 5 Mo maximum</p>
      </div>
    </div>
  );
}

function CompanyDashboard({
  go,
  company,
  offers,
  today,
  applications,
  updateStatus,
  onCreateOffer,
  onChangeOfferStatus,
}: {
  go: (p: Page) => void;
  company: Company;
  offers: Offer[]; // uniquement les offres de cette entreprise
  today: string;
  applications: RecruitApplication[];
  updateStatus: (name: string, status: string) => void;
  onCreateOffer: (input: OfferInput, status: OfferStatus) => void;
  /** Renvoie null si le changement a réussi, sinon le message d'erreur. */
  onChangeOfferStatus: (offerId: number) => string | null;
}) {
  const [active, setActive] = useState("Aperçu");
  const [publish, setPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  // Message affiché quand une offre ne peut pas être (re)mise en ligne car incomplète ou expirée.
  const [statusError, setStatusError] = useState("");
  const showApplications = active === "Candidatures";
  // « Offres actives » = offres réellement visibles par le public.
  const activeOffersCount = offers.filter((offer) => isPubliclyVisible(offer, today)).length;

  /** Enregistre l'offre complète créée depuis la modale, avec le statut demandé. */
  const addOffer = (input: OfferInput, status: OfferStatus) => {
    onCreateOffer(input, status);
    setPublish(false);
    setPublished(status === "PUBLISHED");
    setDraftSaved(status === "DRAFT");
    setStatusError("");
    setActive("Mes offres");
  };

  /** Bouton « Publier / Clôturer / Réouvrir » : la règle est appliquée par useOffers. */
  const changeOfferStatus = (offer: Offer) => {
    const error = onChangeOfferStatus(offer.id);
    setStatusError(error ?? "");
    if (error) {
      setPublished(false);
      setDraftSaved(false);
    }
  };
  return (
    <DashboardLayout area="company" go={go} active={active} setActive={setActive}>
      <DashboardTop
        title={active === "Aperçu" ? "Espace entreprise" : active}
        subtitle={`${company.name} · Compte vérifié`}
        action="Publier une offre"
        onAction={() => setPublish(true)}
        avatar={company.initials}
      />
      <div className="dashboard-content">
        {published && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={19} />
            Votre offre a été publiée avec succès.
          </div>
        )}
        {draftSaved && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            <FileCheck2 size={19} />
            Le brouillon fictif a été enregistré dans vos offres.
          </div>
        )}
        {statusError && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
          >
            <FileCheck2 size={19} className="shrink-0" />
            {statusError}
          </div>
        )}
        {active === "Aperçu" && (
          <>
            <div className="stats-grid">
              <StatCard
                icon={BriefcaseBusiness}
                value={String(activeOffersCount)}
                label="Offres actives"
                tone="blue"
              />
              <StatCard
                icon={UsersRound}
                value={String(applications.length)}
                label="Candidatures reçues"
                tone="green"
              />
              <StatCard
                icon={Eye}
                value={String(
                  applications.filter((item) => ["Envoyée", "En examen"].includes(item.status))
                    .length,
                )}
                label="À examiner"
                tone="amber"
              />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="content-card overflow-hidden">
                <CardHeading
                  title="Candidatures récentes"
                  action="Tout voir"
                  onAction={() => setActive("Candidatures")}
                />
                <RecruitTable items={applications} updateStatus={updateStatus} />
              </div>
              <div className="content-card p-6">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <ShieldCheck size={17} /> ENTREPRISE VÉRIFIÉE
                </span>
                <h3 className="mt-4 font-bold text-[#0c2340]">{company.name}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Services professionnels · Conakry
                </p>
                <div className="mt-5 border-t border-slate-100 pt-5 text-xs text-slate-500">
                  <p className="flex justify-between">
                    <span>Profil complété</span>
                    <b className="text-[#0c2340]">100%</b>
                  </p>
                </div>
                <button
                  onClick={() => setActive("Profil entreprise")}
                  className="btn-secondary mt-5 w-full"
                >
                  Voir le profil
                </button>
              </div>
            </div>
          </>
        )}
        {showApplications && (
          <div className="content-card overflow-hidden">
            <CardHeading title="Candidatures reçues" />
            <RecruitTable items={applications} updateStatus={updateStatus} />
          </div>
        )}
        {active === "Mes offres" && (
          <div className="content-card overflow-hidden">
            <CardHeading
              title="Mes offres publiées"
              action="Nouvelle offre"
              onAction={() => setPublish(true)}
            />
            <div className="divide-y divide-slate-100">
              {offers.map((offer) => {
                const view = toJobView(offer, company);
                const displayStatus = getDisplayStatus(offer, today);
                // TEMPORAIRE : les candidatures fictives sont reliées à l'offre par son titre.
                // Elles le seront par un identifiant lors de l'étape « candidatures ».
                const applicationsCount = applications.filter(
                  (item) => item.role === offer.title,
                ).length;
                return (
                  <div key={offer.id} className="flex flex-wrap items-center gap-4 p-5">
                    <JobLogo job={view} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0c2340]">{offer.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {offer.publishedAt
                          ? `${applicationsCount} candidature(s) · ${view.posted}`
                          : `Créée le ${formatShortDate(offer.createdAt)}`}
                      </p>
                    </div>
                    <span className={`status ${offerStatusStyle[displayStatus]}`}>
                      {OFFER_DISPLAY_STATUS_LABELS[displayStatus]}
                    </span>
                    <button onClick={() => changeOfferStatus(offer)} className="offer-toggle">
                      {offer.status === "DRAFT"
                        ? "Publier"
                        : offer.status === "PUBLISHED"
                          ? "Clôturer"
                          : "Réouvrir"}
                    </button>
                  </div>
                );
              })}
              {!offers.length && (
                <p className="p-5 text-sm text-slate-400">
                  Vous n’avez encore publié aucune offre.
                </p>
              )}
            </div>
          </div>
        )}
        {active === "Profil entreprise" && <CompanyProfile />}
      </div>
      {publish && (
        <PublishModal
          onClose={() => setPublish(false)}
          onPublish={(offer) => addOffer(offer, "PUBLISHED")}
          onDraft={(offer) => addOffer(offer, "DRAFT")}
        />
      )}
    </DashboardLayout>
  );
}

function CompanyProfile() {
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="content-card max-w-3xl p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">
          Nom de l’entreprise
          <input required defaultValue="Kamsar Solutions" />
        </label>
        <label className="form-label">
          Secteur
          <select required defaultValue="Services professionnels">
            <option>Services professionnels</option>
            <option>Technologie</option>
          </select>
        </label>
        <label className="form-label">
          Ville
          <select required defaultValue="Conakry">
            <option>Conakry</option>
            <option>Kindia</option>
          </select>
        </label>
        <label className="form-label sm:col-span-2">
          Description
          <textarea
            required
            rows={5}
            defaultValue="Cabinet guinéen spécialisé dans l’accompagnement des organisations et le développement de projets."
          />
        </label>
        <label className="form-label">
          E-mail de contact
          <input required type="email" defaultValue="recrutement@exemple.gn" />
        </label>
        <label className="form-label">
          Téléphone
          <input defaultValue="+224 600 00 00 00" />
        </label>
      </div>
      <button type="submit" className="btn-primary mt-6">
        {saved && <Check size={17} />}
        {saved ? "Modifications enregistrées" : "Enregistrer"}
      </button>
    </form>
  );
}

function AdminDashboard({ go }: { go: (p: Page) => void }) {
  const [active, setActive] = useState("Vue générale");
  const [companies, setCompanies] = useState<PendingCompany[]>(initialPendingCompanies);
  const [offers, setOffers] = useState<ModeratedOffer[]>(initialModeratedOffers);
  const verify = (name: string, status: string) =>
    setCompanies((x) => x.map((c) => (c.name === name ? { ...c, status } : c)));
  const moderate = (title: string, status: string) =>
    setOffers((x) => x.map((o) => (o.title === title ? { ...o, status } : o)));
  return (
    <DashboardLayout area="admin" go={go} active={active} setActive={setActive}>
      <DashboardTop
        title={active === "Vue générale" ? "Tableau de bord administrateur" : active}
        subtitle="Contrôle et qualité de la plateforme"
        avatar="AD"
      />
      <div className="dashboard-content">
        {active === "Vue générale" && (
          <>
            <div className="stats-grid">
              <StatCard
                icon={Building2}
                value={String(companies.filter((c) => c.status === "En attente").length)}
                label="Entreprises à vérifier"
                tone="amber"
              />
              <StatCard
                icon={FileCheck2}
                value={String(offers.filter((o) => o.status === "À examiner").length)}
                label="Offres à modérer"
                tone="blue"
              />
              <StatCard icon={UsersRound} value="128" label="Utilisateurs actifs" tone="green" />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <AdminCompanies companies={companies} verify={verify} compact />
              <AdminOffers offers={offers} moderate={moderate} compact />
            </div>
          </>
        )}
        {active === "Entreprises" && <AdminCompanies companies={companies} verify={verify} />}
        {active === "Modération" && <AdminOffers offers={offers} moderate={moderate} />}
      </div>
    </DashboardLayout>
  );
}

function AdminCompanies({
  companies,
  verify,
  compact,
}: {
  companies: PendingCompany[];
  verify: (n: string, s: string) => void;
  compact?: boolean;
}) {
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Entreprises à vérifier" />
      <div className="divide-y divide-slate-100">
        {companies.slice(0, compact ? 3 : companies.length).map((c) => (
          <div key={c.name} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 font-bold text-blue-700">
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0c2340]">{c.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.sector} · {c.city} · {c.date}
                </p>
              </div>
              <span
                className={`status ${c.status === "Approuvée" ? "bg-emerald-50 text-emerald-700" : c.status === "Refusée" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
              >
                {c.status}
              </span>
            </div>
            {c.status === "En attente" && (
              <>
                {rejecting === c.name && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3">
                    <label className="text-xs font-bold text-red-800">
                      Motif du refus
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-red-200 bg-white p-2 font-normal text-slate-700 outline-none focus:border-red-400"
                        placeholder="Précisez les informations manquantes ou non conformes…"
                      />
                    </label>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejecting("");
                          setReason("");
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Annuler
                      </button>
                      <button
                        disabled={!reason.trim()}
                        onClick={() => {
                          verify(c.name, "Refusée");
                          setRejecting("");
                          setReason("");
                        }}
                        className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirmer le refus
                      </button>
                    </div>
                  </div>
                )}
                {rejecting !== c.name && (
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setRejecting(c.name)} className="btn-danger">
                      <XCircle size={15} /> Refuser
                    </button>
                    <button onClick={() => verify(c.name, "Approuvée")} className="btn-success">
                      <Check size={15} /> Approuver
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminOffers({
  offers,
  moderate,
  compact,
}: {
  offers: ModeratedOffer[];
  moderate: (t: string, s: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Modération des offres" />
      <div className="divide-y divide-slate-100">
        {offers.slice(0, compact ? 2 : offers.length).map((o) => (
          <div key={o.title} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
                <FileCheck2 size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0c2340]">{o.title}</p>
                <p className="mt-1 text-xs text-slate-400">{o.company}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700">{o.reason}</p>
              </div>
            </div>
            {o.status === "À examiner" ? (
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => moderate(o.title, "Suspendue")} className="btn-danger">
                  Suspendre
                </button>
                <button onClick={() => moderate(o.title, "Maintenue")} className="btn-success">
                  Maintenir
                </button>
              </div>
            ) : (
              <div className="mt-3 text-right">
                <span
                  className={`status ${o.status === "Suspendue" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {o.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Entreprise de démonstration (temporaire, en attendant l'authentification).
const demoCompany = findCompany(DEMO_COMPANY_ID);

export default function App() {
  const [page, setPage] = useState<Page>("home");
  // Source unique des offres : partagée entre l'espace entreprise et les pages publiques.
  const { publicOffers, today, getCompanyOffers, createOffer, changeOfferStatus } = useOffers();
  // Offres publiques converties au format d'affichage des composants existants.
  const publicJobs = useMemo(
    () => publicOffers.map((offer) => toJobView(offer, findCompany(offer.companyId))),
    [publicOffers],
  );
  // On mémorise l'identifiant de l'offre consultée, pas une copie : on lit
  // toujours sa version à jour (et on sait si elle n'est plus publique).
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const selectedJob = publicJobs.find((job) => job.id === selectedJobId);
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);
  const [recruitApplications, setRecruitApplications] = useState<RecruitApplication[]>(
    initialRecruitApplications,
  );
  const updateApplicationStatus = (name: string, status: string) =>
    setRecruitApplications((items) =>
      items.map((item) => (item.name === name ? { ...item, status } : item)),
    );
  const go = (target: Page) => {
    setPage(target);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectJob = (job: Job) => {
    setSelectedJobId(job.id);
    go("job");
  };
  const jobsPage = (
    <JobsPage
      jobs={publicJobs}
      search={search}
      setSearch={setSearch}
      city={searchCity}
      setCity={setSearchCity}
      selectJob={selectJob}
    />
  );
  const isDashboard = ["candidate", "company", "admin"].includes(page);
  const publicHeader = !["login", "register"].includes(page);
  return (
    <>
      {publicHeader && !isDashboard && (
        <Header page={page} go={go} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      )}
      {isDashboard && (
        <div className="md:hidden">
          <Header page={page} go={go} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        </div>
      )}
      {page === "home" && (
        <Home
          jobs={publicJobs}
          go={go}
          selectJob={selectJob}
          setSearch={setSearch}
          setCity={setSearchCity}
        />
      )}
      {page === "jobs" && jobsPage}
      {page === "job" &&
        // Si l'offre n'est plus publique (clôturée, expirée…), on revient à la liste.
        (selectedJob ? (
          <JobDetails
            job={selectedJob}
            go={go}
            applied={appliedIds.includes(selectedJob.id)}
            onApply={() =>
              setAppliedIds((ids) =>
                ids.includes(selectedJob.id) ? ids : [...ids, selectedJob.id],
              )
            }
          />
        ) : (
          jobsPage
        ))}
      {page === "login" && <AuthPage mode="login" go={go} />}
      {page === "register" && <AuthPage mode="register" go={go} />}
      {page === "candidate" && (
        <CandidateDashboard
          jobs={publicJobs}
          go={go}
          applicationStatus={
            recruitApplications.find((item) => item.name === "Mariama Diallo")?.status ?? "Envoyée"
          }
        />
      )}
      {page === "company" && demoCompany && (
        <CompanyDashboard
          go={go}
          company={demoCompany}
          offers={getCompanyOffers(demoCompany.id)}
          today={today}
          applications={recruitApplications}
          updateStatus={updateApplicationStatus}
          onCreateOffer={(input, status) => createOffer(demoCompany.id, input, status)}
          onChangeOfferStatus={changeOfferStatus}
        />
      )}
      {page === "admin" && <AdminDashboard go={go} />}
    </>
  );
}
