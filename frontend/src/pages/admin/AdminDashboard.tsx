import { useState } from "react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import type { Page } from "../../types/navigation";
import type { DashboardIdentity } from "../../types/auth";
import type { AdminCompaniesState } from "../../features/admin/useAdminCompanies";
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
  /** Nombre d’entreprises ayant ce statut (« – » tant que la liste n’est pas chargée). */
  const count = (status: "PENDING" | "APPROVED" | "REJECTED") =>
    companies.status === "success"
      ? String(companies.companies.filter((c) => c.status === status).length)
      : "–";
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
                value={count("PENDING")}
                label="Entreprises à vérifier"
                tone="amber"
              />
              <StatCard
                icon={CheckCircle2}
                value={count("APPROVED")}
                label="Entreprises validées"
                tone="green"
              />
              <StatCard
                icon={XCircle}
                value={count("REJECTED")}
                label="Entreprises refusées"
                tone="blue"
              />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <AdminCompanies state={companies} compact />
              <AdminOffers />
            </div>
          </>
        )}
        {active === "Entreprises" && <AdminCompanies state={companies} />}
        {active === "Modération" && <AdminOffers />}
      </div>
    </DashboardLayout>
  );
}
