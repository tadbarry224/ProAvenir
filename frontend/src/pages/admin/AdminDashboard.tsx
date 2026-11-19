import { useState } from "react";
import { Building2, FileCheck2, UsersRound } from "lucide-react";
import type { Page } from "../../types/navigation";
import type { DashboardIdentity } from "../../types/auth";
import type { ModeratedOffer } from "../../types/admin";
import type { AdminCompaniesState } from "../../features/admin/useAdminCompanies";
import { initialModeratedOffers } from "../../data/mockAdmin";
import { StatCard } from "../../components/ui/StatCard";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { DashboardTop } from "../../components/layout/DashboardTop";
import { AdminCompanies } from "./AdminCompanies";
import { AdminOffers } from "./AdminOffers";

export function AdminDashboard({
  go,
  identity,
  companies,
}: {
  go: (p: Page) => void;
  identity: DashboardIdentity;
  /** Entreprises RÉELLES (API) : liste, décisions et états de chargement. */
  companies: AdminCompaniesState;
}) {
  const [active, setActive] = useState("Vue générale");
  // Modération des offres : encore une démonstration (pas de signalements en base).
  const [offers, setOffers] = useState<ModeratedOffer[]>(initialModeratedOffers);
  const moderate = (title: string, status: string) =>
    setOffers((x) => x.map((o) => (o.title === title ? { ...o, status } : o)));
  return (
    <DashboardLayout area="admin" identity={identity} go={go} active={active} setActive={setActive}>
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
                value={companies.status === "success" ? String(companies.pendingCount) : "–"}
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
              <AdminCompanies state={companies} compact />
              <AdminOffers offers={offers} moderate={moderate} compact />
            </div>
          </>
        )}
        {active === "Entreprises" && <AdminCompanies state={companies} />}
        {active === "Modération" && <AdminOffers offers={offers} moderate={moderate} />}
      </div>
    </DashboardLayout>
  );
}
