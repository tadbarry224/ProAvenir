import { useState } from "react";
import { Building2, FileCheck2, UsersRound } from "lucide-react";
import type { Page } from "../../types/navigation";
import type { ModeratedOffer, PendingCompany } from "../../types/admin";
import { initialModeratedOffers, initialPendingCompanies } from "../../data/mockAdmin";
import { StatCard } from "../../components/ui/StatCard";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { DashboardTop } from "../../components/layout/DashboardTop";
import { AdminCompanies } from "./AdminCompanies";
import { AdminOffers } from "./AdminOffers";

export function AdminDashboard({ go }: { go: (p: Page) => void }) {
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
