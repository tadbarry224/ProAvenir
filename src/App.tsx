import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  ShieldCheck,
  Upload,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  OFFER_DISPLAY_STATUS_LABELS,
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
import { formatShortDate } from "./lib/dates";
import { DEMO_COMPANY_ID, findCompany } from "./data/mockCompanies";
import { candidateApplications, initialRecruitApplications } from "./data/mockApplications";
import { initialModeratedOffers, initialPendingCompanies } from "./data/mockAdmin";
import { StatCard } from "./components/ui/StatCard";
import { CardHeading } from "./components/ui/CardHeading";
import { JobLogo } from "./components/jobs/JobLogo";
import { MiniJob } from "./components/jobs/MiniJob";
import { Header } from "./components/layout/Header";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DashboardTop } from "./components/layout/DashboardTop";
import { offerStatusStyle } from "./features/offers/offerStatusStyle";
import { ApplicationTable } from "./features/applications/ApplicationTable";
import { RecruitTable } from "./features/applications/RecruitTable";
import { PublishModal } from "./features/offers/PublishModal";
import { Home } from "./pages/Home";
import { JobsPage } from "./pages/JobsPage";
import { JobDetails } from "./pages/JobDetails";
import { AuthPage } from "./pages/AuthPage";

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
