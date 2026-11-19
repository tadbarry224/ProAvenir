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
import { DEMO_CANDIDATE_APPLICATION_ID, initialRecruitApplications } from "./data/mockApplications";
import { SESSION_EXPIRED_MESSAGE } from "./services/apiClient";
import { Header } from "./components/layout/Header";
import { Home } from "./pages/Home";
import { JobsPage } from "./pages/JobsPage";
import { JobDetails } from "./pages/JobDetails";
import { AuthPage } from "./pages/AuthPage";
import { CandidateDashboard } from "./pages/candidate/CandidateDashboard";
import { CompanyDashboard } from "./pages/company/CompanyDashboard";
import { AdminDashboard } from "./pages/admin/AdminDashboard";

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
  // Message affiché sur la page de connexion après l'expiration de la session.
  const [sessionNotice, setSessionNotice] = useState("");
  // Offres publiques : chargées depuis l'API (PostgreSQL), sans filtre.
  // Utilisées par l'accueil, les offres recommandées et le compteur par type.
  const { jobs: publicJobs, reload: reloadPublicOffers } = usePublicOffers();
  // Offre consultée (choisie depuis l'accueil ou la liste filtrée par l'API).
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [recruitApplications, setRecruitApplications] = useState<RecruitApplication[]>(
    initialRecruitApplications,
  );
  const updateApplicationStatus = (id: string, status: string) =>
    setRecruitApplications((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  const go = (target: Page) => {
    if (target === "logout") {
      // Révoque la session côté serveur (cookie) et oublie le jeton en mémoire.
      void auth.logout();
      target = "home";
    }
    setSessionNotice("");
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

  // Offres de l'espace entreprise : celles de l'entreprise de la SESSION, lues dans
  // PostgreSQL via l'API, rechargées à chaque ouverture de l'espace (F5 compris).
  const companyOffers = useOffers({
    session: auth,
    userId: auth.user?.id ?? null,
    enabled: page === "company" && allowed,
    // Une publication ou une clôture change la liste publique : on la relit.
    onChanged: reloadPublicOffers,
    // La session est effacée et l'application revient à la connexion : on explique pourquoi.
    onSessionExpired: () => setSessionNotice(SESSION_EXPIRED_MESSAGE),
  });

  // Identité affichée : toujours la personne connectée. Les CANDIDATURES fictives
  // ne sont montrées qu'aux comptes de démonstration (vraies données en B5).
  const identity = auth.user ? identityOf(auth.user) : null;
  const showDemoData = ownsDemoData(auth.user);

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
            // Seul un compte candidat peut postuler (null = visiteur non connecté).
            viewerRole={auth.status === "authenticated" ? (auth.user?.role ?? null) : null}
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
      {page === "login" && <AuthPage mode="login" go={go} notice={sessionNotice} />}
      {page === "register" && <AuthPage mode="register" go={go} />}
      {page === "candidate" && allowed && identity && (
        <CandidateDashboard
          jobs={publicJobs}
          go={go}
          identity={identity}
          showDemoData={showDemoData}
          applicationStatus={
            recruitApplications.find((item) => item.id === DEMO_CANDIDATE_APPLICATION_ID)?.status ??
            "Envoyée"
          }
        />
      )}
      {page === "company" && allowed && identity && (
        <CompanyDashboard
          go={go}
          company={{
            name: identity.name,
            initials: identity.initials,
            logoColor: auth.user?.company?.logoColor ?? "blue",
          }}
          identity={identity}
          companyOffers={companyOffers}
          applications={showDemoData ? recruitApplications : []}
          updateStatus={updateApplicationStatus}
        />
      )}
      {page === "admin" && allowed && identity && <AdminDashboard go={go} identity={identity} />}
    </>
  );
}
