import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import type { Job } from "./types/offer";
import { jobPath, PAGE_PATHS, pageFromPath, type Page } from "./types/navigation";
import type { RecruitApplication } from "./types/application";
import { PROTECTED_PAGES, ROLE_HOME, type UserRole } from "./types/auth";
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
import { JobDetailsPage } from "./pages/JobDetailsPage";
import { AuthPage } from "./pages/AuthPage";
import { CandidateDashboard } from "./pages/candidate/CandidateDashboard";
import { CompanyDashboard } from "./pages/company/CompanyDashboard";
import { AdminDashboard } from "./pages/admin/AdminDashboard";

export default function App() {
  return (
    // BrowserRouter : la page affichée suit l'adresse du navigateur (F5, Retour, liens partagés).
    <BrowserRouter>
      <AuthProvider>
        <ProAvenirApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

/**
 * Mémorisé avec l'adresse de la page de connexion : la page à rouvrir une fois
 * connecté (ex. l'offre sur laquelle le visiteur voulait postuler).
 */
type LoginState = { from?: string } | null;

/** N'accepte qu'une adresse interne (« /offres/… »), jamais un autre site (« //… »). */
const internalPath = (path: unknown): string | null =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : null;

function ProAvenirApp() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Page déduite de l'adresse ; null = adresse inconnue (redirigée vers l'accueil).
  const page = pageFromPath(location.pathname);
  const loginFrom = internalPath((location.state as LoginState)?.from);

  // Message affiché sur la page de connexion après l'expiration de la session.
  const [sessionNotice, setSessionNotice] = useState("");
  // Offres publiques : chargées depuis l'API (PostgreSQL), sans filtre.
  // Utilisées par l'accueil, les offres recommandées et le compteur par type.
  const { jobs: publicJobs, reload: reloadPublicOffers } = usePublicOffers();
  // Dernière offre cliquée : affichée tout de suite sur sa page, le temps que l'API la confirme.
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

  // Le menu mobile se referme à chaque changement de page (y compris avec « Retour »).
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const open = (path: string, state?: LoginState) => {
    setSessionNotice("");
    navigate(path, { state });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const go = (target: Page) => {
    if (target === "logout") {
      // Révoque la session côté serveur (cookie) et oublie le jeton en mémoire.
      void auth.logout();
      target = "home";
    }
    if (target === "job") target = "jobs"; // une offre précise s'ouvre avec selectJob
    // Entre connexion et inscription, on garde la page à rouvrir ensuite.
    const keepFrom = (target === "login" || target === "register") && loginFrom;
    open(PAGE_PATHS[target], keepFrom ? { from: loginFrom } : undefined);
  };
  const selectJob = (job: Job) => {
    setSelectedJob(job);
    open(jobPath(job.id));
  };
  /** Ouvre la connexion en retenant la page actuelle, rouverte après la connexion. */
  const loginAndReturn = () => open(PAGE_PATHS.login, { from: location.pathname });
  const afterAuthentication = (role: UserRole) => {
    if (loginFrom) navigate(loginFrom, { replace: true });
    else go(ROLE_HOME[role]);
  };

  // Espaces protégés : session valide ET bon rôle. Sinon, redirection vers la
  // connexion (pas de session) ou vers l'espace du rôle de l'utilisateur.
  // L'API applique de son côté ses propres contrôles (JwtAuthGuard, RolesGuard).
  const requiredRole = page ? PROTECTED_PAGES[page] : undefined;
  const allowed =
    !requiredRole || (auth.status === "authenticated" && auth.user?.role === requiredRole);
  useEffect(() => {
    if (!requiredRole || auth.status === "loading") return;
    if (auth.status === "anonymous") {
      // `replace` : « Retour » ne ramène pas sur l'espace protégé refusé.
      navigate(PAGE_PATHS.login, { replace: true, state: { from: location.pathname } });
    } else if (auth.user && auth.user.role !== requiredRole) {
      navigate(PAGE_PATHS[ROLE_HOME[auth.user.role]], { replace: true });
    }
  }, [requiredRole, auth.status, auth.user, navigate, location.pathname]);

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
  const isDashboard = page === "candidate" || page === "company" || page === "admin";
  const publicHeader = page !== "login" && page !== "register";
  const header = (
    <Header page={page ?? "home"} go={go} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
  );
  return (
    <>
      {publicHeader && !isDashboard && header}
      {isDashboard && <div className="md:hidden">{header}</div>}
      <Routes>
        <Route
          path={PAGE_PATHS.home}
          element={
            <Home
              jobs={publicJobs}
              go={go}
              selectJob={selectJob}
              setSearch={setSearch}
              setCity={setSearchCity}
            />
          }
        />
        <Route path={PAGE_PATHS.jobs} element={jobsPage} />
        <Route
          path={`${PAGE_PATHS.jobs}/:id`}
          element={
            <JobRoute
              preview={selectedJob}
              go={go}
              // Seul un compte candidat peut postuler (null = visiteur non connecté).
              viewerRole={auth.status === "authenticated" ? (auth.user?.role ?? null) : null}
              onLogin={loginAndReturn}
              appliedIds={appliedIds}
              onApply={(id) => setAppliedIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
            />
          }
        />
        <Route
          path={PAGE_PATHS.login}
          element={
            <AuthPage
              mode="login"
              go={go}
              notice={sessionNotice}
              onAuthenticated={afterAuthentication}
            />
          }
        />
        <Route
          path={PAGE_PATHS.register}
          element={<AuthPage mode="register" go={go} onAuthenticated={afterAuthentication} />}
        />
        <Route
          path={PAGE_PATHS.candidate}
          element={
            allowed &&
            identity && (
              <CandidateDashboard
                jobs={publicJobs}
                go={go}
                identity={identity}
                showDemoData={showDemoData}
                applicationStatus={
                  recruitApplications.find((item) => item.id === DEMO_CANDIDATE_APPLICATION_ID)
                    ?.status ?? "Envoyée"
                }
              />
            )
          }
        />
        <Route
          path={PAGE_PATHS.company}
          element={
            allowed &&
            identity && (
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
            )
          }
        />
        <Route
          path={PAGE_PATHS.admin}
          element={allowed && identity && <AdminDashboard go={go} identity={identity} />}
        />
        {/* Adresse inconnue : retour à l'accueil. */}
        <Route path="*" element={<Navigate to={PAGE_PATHS.home} replace />} />
      </Routes>
    </>
  );
}

/** Page /offres/:id : lit l'identifiant dans l'adresse. */
function JobRoute({
  appliedIds,
  onApply,
  ...props
}: Omit<Parameters<typeof JobDetailsPage>[0], "id" | "applied" | "onApply"> & {
  appliedIds: string[];
  onApply: (id: string) => void;
}) {
  const { id = "" } = useParams();
  return (
    <JobDetailsPage
      // `key` : changer d'offre repart d'un état neuf (fenêtre de candidature fermée…).
      key={id}
      id={id}
      applied={appliedIds.includes(id)}
      onApply={() => onApply(id)}
      {...props}
    />
  );
}
