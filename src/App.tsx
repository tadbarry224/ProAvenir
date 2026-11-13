import { useEffect, useState } from "react";
import type { Job } from "./types/offer";
import type { Page } from "./types/navigation";
import type { RecruitApplication } from "./types/application";
import { PROTECTED_PAGES, ROLE_HOME } from "./types/auth";
import { AuthProvider } from "./features/auth/AuthProvider";
import { useAuth } from "./features/auth/authContext";
import { identityOf, ownsDemoData } from "./features/auth/identity";
import { useOffers } from "./features/offers/useOffers";
import { usePublicOffers } from "./features/offers/usePublicOffers";
import { DEMO_COMPANY_ID, findCompany } from "./data/mockCompanies";
import { initialRecruitApplications } from "./data/mockApplications";
import { Header } from "./components/layout/Header";
import { Home } from "./pages/Home";
import { JobsPage } from "./pages/JobsPage";
import { JobDetails } from "./pages/JobDetails";
import { AuthPage } from "./pages/AuthPage";
import { CandidateDashboard } from "./pages/candidate/CandidateDashboard";
import { CompanyDashboard } from "./pages/company/CompanyDashboard";
import { AdminDashboard } from "./pages/admin/AdminDashboard";

// Entreprise de démonstration : le CONTENU de l'espace entreprise reste fictif jusqu'à B4
// (l'accès, lui, exige déjà une session avec le rôle COMPANY).
const demoCompany = findCompany(DEMO_COMPANY_ID);
// Identifiant local des offres créées par une entreprise autre que celle de démonstration
// (mémoire du navigateur uniquement, jusqu'à B4).
const LOCAL_COMPANY_ID = 0;

export default function App() {
  return (
    <AuthProvider>
      <ProAvenirApp />
    </AuthProvider>
  );
}

function ProAvenirApp() {
  const [page, setPage] = useState<Page>("home");
  const auth = useAuth();
  // Offres de l'espace entreprise : données locales fictives jusqu'à l'étape B4.
  const { today, getCompanyOffers, createOffer, changeOfferStatus } = useOffers();
  // Offres publiques : chargées depuis l'API (PostgreSQL), sans filtre.
  // Utilisées par l'accueil, les offres recommandées et le compteur par type.
  const { jobs: publicJobs } = usePublicOffers();
  // Offre consultée (choisie depuis l'accueil ou la liste filtrée par l'API).
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [recruitApplications, setRecruitApplications] = useState<RecruitApplication[]>(
    initialRecruitApplications,
  );
  const updateApplicationStatus = (name: string, status: string) =>
    setRecruitApplications((items) =>
      items.map((item) => (item.name === name ? { ...item, status } : item)),
    );
  const go = (target: Page) => {
    if (target === "logout") {
      // Révoque la session côté serveur (cookie) et oublie le jeton en mémoire.
      void auth.logout();
      target = "home";
    }
    setPage(target);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectJob = (job: Job) => {
    setSelectedJob(job);
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
  // Espaces protégés : session valide ET bon rôle. Sinon, redirection vers la
  // connexion (pas de session) ou vers l'espace du rôle de l'utilisateur.
  // L'API applique de son côté ses propres contrôles (JwtAuthGuard, RolesGuard).
  const requiredRole = PROTECTED_PAGES[page];
  const allowed =
    !requiredRole || (auth.status === "authenticated" && auth.user?.role === requiredRole);
  useEffect(() => {
    if (!requiredRole || auth.status === "loading") return;
    if (auth.status === "anonymous") setPage("login");
    else if (auth.user && auth.user.role !== requiredRole) setPage(ROLE_HOME[auth.user.role]);
  }, [requiredRole, auth.status, auth.user]);

  // Identité affichée : toujours la personne connectée. Les données fictives
  // (candidatures, offres de l'entreprise) ne sont montrées qu'aux comptes de
  // démonstration ; un nouveau compte voit un espace vide (vraies données en B4–B5).
  const identity = auth.user ? identityOf(auth.user) : null;
  const showDemoData = ownsDemoData(auth.user);
  const dashboardCompany =
    showDemoData && demoCompany
      ? demoCompany
      : {
          id: LOCAL_COMPANY_ID,
          name: identity?.name ?? "",
          initials: identity?.initials ?? "",
          logoColor: "blue",
        };

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
      {page === "candidate" && allowed && identity && (
        <CandidateDashboard
          jobs={publicJobs}
          go={go}
          identity={identity}
          showDemoData={showDemoData}
          applicationStatus={
            recruitApplications.find((item) => item.name === "Mariama Diallo")?.status ?? "Envoyée"
          }
        />
      )}
      {page === "company" && allowed && identity && (
        <CompanyDashboard
          go={go}
          company={dashboardCompany}
          identity={identity}
          offers={getCompanyOffers(dashboardCompany.id)}
          today={today}
          applications={showDemoData ? recruitApplications : []}
          updateStatus={updateApplicationStatus}
          onCreateOffer={(input, status) => createOffer(dashboardCompany.id, input, status)}
          onChangeOfferStatus={changeOfferStatus}
        />
      )}
      {page === "admin" && allowed && identity && <AdminDashboard go={go} identity={identity} />}
    </>
  );
}
