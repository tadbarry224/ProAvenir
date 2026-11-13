import { useState } from "react";
import { CheckCircle2, Eye, FileText } from "lucide-react";
import type { Job } from "../../types/offer";
import type { Page } from "../../types/navigation";
import { candidateApplications } from "../../data/mockApplications";
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
