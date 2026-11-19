import { useState, type ReactNode } from "react";
import { CheckCircle2, Eye, FileText } from "lucide-react";
import type { Job } from "../../types/offer";
import type { Page } from "../../types/navigation";
import type { DashboardIdentity } from "../../types/auth";
import type { CandidateApplicationsState } from "../../features/applications/useApplications";
import { StatCard } from "../../components/ui/StatCard";
import { CardHeading } from "../../components/ui/CardHeading";
import { MiniJob } from "../../components/jobs/MiniJob";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { DashboardTop } from "../../components/layout/DashboardTop";
import { ApplicationTable } from "../../features/applications/ApplicationTable";
import { CandidateProfile } from "./CandidateProfile";

export function CandidateDashboard({
  jobs,
  go,
  identity,
  applications: state,
}: {
  jobs: Job[]; // offres publiques, pour les « Offres recommandées »
  go: (p: Page) => void;
  identity: DashboardIdentity;
  /** Candidatures RÉELLES du candidat connecté (API). */
  applications: CandidateApplicationsState;
}) {
  const [active, setActive] = useState("Aperçu");
  const { applications } = state;
  const loaded = state.status === "success";
  /** Valeur d'une carte de statistique : « … » tant que la liste n'est pas chargée. */
  const stat = (count: number) => (loaded ? String(count) : "…");

  /** Tableau des candidatures, ou l'état du chargement (jamais de données fictives). */
  const applicationsList = (): ReactNode => {
    if (state.status === "error") {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <span className="text-red-700">{state.error}</span>
          <button onClick={state.reload} className="btn-secondary px-3 py-1.5 text-xs">
            Réessayer
          </button>
        </div>
      );
    }
    if (!loaded) {
      return <p className="p-5 text-sm text-slate-400">Chargement de vos candidatures…</p>;
    }
    if (applications.length === 0) {
      return (
        <p className="p-5 text-sm text-slate-500">
          Vous n’avez pas encore postulé.{" "}
          <button onClick={() => go("jobs")} className="text-link">
            Voir les offres
          </button>
        </p>
      );
    }
    return <ApplicationTable items={applications} />;
  };

  return (
    <DashboardLayout
      area="candidate"
      identity={identity}
      go={go}
      active={active}
      setActive={setActive}
    >
      <DashboardTop
        title={active === "Aperçu" ? `Bonjour, ${identity.firstName}` : active}
        subtitle={
          active === "Aperçu"
            ? "Voici où en sont vos démarches."
            : "Gérez vos informations et votre parcours."
        }
        avatar={identity.initials}
      />
      <div className="dashboard-content">
        {active === "Aperçu" && (
          <>
            <div className="stats-grid">
              <StatCard
                icon={FileText}
                value={stat(applications.length)}
                label="Candidatures envoyées"
                tone="blue"
              />
              <StatCard
                icon={Eye}
                value={stat(
                  applications.filter((item) => ["SENT", "IN_REVIEW"].includes(item.status)).length,
                )}
                label="En cours"
                tone="amber"
              />
              <StatCard
                icon={CheckCircle2}
                value={stat(
                  applications.filter((item) => ["SHORTLISTED", "ACCEPTED"].includes(item.status))
                    .length,
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
                {applicationsList()}
              </div>
              <div className="content-card p-6">
                <h2 className="font-bold text-[#0c2340]">Votre profil</h2>
                <div className="mt-6 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                    {identity.initials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0c2340]">{identity.name}</p>
                    <p className="text-xs text-slate-400">Compte candidat</p>
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
        {active === "Mon profil" && <CandidateProfile fullName={identity.name} />}
        {active === "Mes candidatures" && (
          <div className="content-card overflow-hidden">
            <CardHeading title="Toutes mes candidatures" />
            {applicationsList()}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
