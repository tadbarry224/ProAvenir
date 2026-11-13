import { useState } from "react";
import type { Job } from "./types/offer";
import type { Page } from "./types/navigation";
import type { RecruitApplication } from "./types/application";
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

// Entreprise de démonstration (temporaire, en attendant l'authentification).
const demoCompany = findCompany(DEMO_COMPANY_ID);

export default function App() {
  const [page, setPage] = useState<Page>("home");
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
