import { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CircleUserRound,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Page } from "../../types/navigation";
import type { DashboardIdentity } from "../../types/auth";
import { Logo } from "./Logo";

export function DashboardLayout({
  area,
  identity,
  go,
  active,
  setActive,
  children,
}: {
  area: "candidate" | "company" | "admin";
  /** Personne connectée (issue de la session). */
  identity: DashboardIdentity;
  go: (p: Page) => void;
  active: string;
  setActive: (x: string) => void;
  children: ReactNode;
}) {
  const menu =
    area === "candidate"
      ? [
          [LayoutDashboard, "Aperçu"],
          [CircleUserRound, "Mon profil"],
          [FileText, "Mes candidatures"],
          [BriefcaseBusiness, "Découvrir les offres"],
        ]
      : area === "company"
        ? [
            [LayoutDashboard, "Aperçu"],
            [Building2, "Profil entreprise"],
            [BriefcaseBusiness, "Mes offres"],
            [UsersRound, "Candidatures"],
          ]
        : [
            [LayoutDashboard, "Vue générale"],
            [ShieldCheck, "Entreprises"],
            [FileCheck2, "Modération"],
          ];
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="px-3">
          <Logo onClick={() => go("home")} />
        </div>
        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
          {area === "admin" ? "Administration" : "Mon espace"}
        </div>
        <nav className="mt-3 space-y-1">
          {menu.map(([Icon, label]) => {
            const IconComponent = Icon as typeof LayoutDashboard;
            return (
              <button
                key={label as string}
                onClick={() =>
                  label === "Découvrir les offres" ? go("jobs") : setActive(label as string)
                }
                className={`dashboard-link ${active === label ? "active" : ""}`}
              >
                <IconComponent size={18} />
                {label as string}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="workspace-card">
            <span>{identity.initials}</span>
            <div>
              <b>{identity.name}</b>
              <small>{identity.statusLabel}</small>
            </div>
          </div>
          <button onClick={() => go("logout")} className="dashboard-link">
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="dashboard-main">
        <nav className="dashboard-mobile-nav">
          {menu.map(([Icon, label]) => {
            const IconComponent = Icon as typeof LayoutDashboard;
            return (
              <button
                key={label as string}
                onClick={() =>
                  label === "Découvrir les offres" ? go("jobs") : setActive(label as string)
                }
                className={active === label ? "active" : ""}
              >
                <IconComponent size={16} />
                <span>{label as string}</span>
              </button>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
}
