import { Menu, X } from "lucide-react";
import type { Page } from "../../types/navigation";
import { Logo } from "./Logo";

export function Header({
  page,
  go,
  mobileOpen,
  setMobileOpen,
}: {
  page: Page;
  go: (page: Page) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
}) {
  const isDashboard = ["candidate", "company", "admin"].includes(page);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="page-shell flex h-[72px] items-center justify-between">
        <Logo onClick={() => go("home")} />
        <nav className="hidden items-center gap-8 md:flex">
          <button
            onClick={() => go("home")}
            className={page === "home" ? "nav-link active" : "nav-link"}
          >
            Accueil
          </button>
          <button
            onClick={() => go("jobs")}
            className={["jobs", "job"].includes(page) ? "nav-link active" : "nav-link"}
          >
            Offres
          </button>
          <button onClick={() => go("company")} className="nav-link">
            Espace entreprise
          </button>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => go("login")} className="btn-ghost">
            Se connecter
          </button>
          <button onClick={() => go("register")} className="btn-primary">
            Créer un compte
          </button>
        </div>
        <button
          className="icon-button md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Ouvrir le menu"
        >
          {mobileOpen ? <X size={21} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {[
              ["home", "Accueil"],
              ["jobs", "Offres"],
              ["candidate", "Espace candidat"],
              ["company", "Espace entreprise"],
              ["admin", "Administration"],
            ].map(([target, label]) => (
              <button
                key={target}
                onClick={() => go(target as Page)}
                className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => go(isDashboard ? "home" : "login")}
              className="btn-primary mt-3 w-full"
            >
              {isDashboard ? "Quitter l’espace" : "Se connecter"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
