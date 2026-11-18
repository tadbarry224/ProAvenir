import type { Page } from "../../types/navigation";
import { Logo } from "./Logo";

export function Footer({ go }: { go: (page: Page) => void }) {
  return (
    <footer className="bg-[#071a2f] text-white">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo onClick={() => go("home")} />
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
            La plateforme guinéenne qui rapproche les talents et les opportunités professionnelles.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Prototype de démonstration — organisations et données fictives.
          </p>
        </div>
        <div>
          <p className="footer-title">Explorer</p>
          <button onClick={() => go("jobs")}>Toutes les offres</button>
          <button onClick={() => go("register")}>Créer un profil</button>
          <button onClick={() => go("company")}>Publier une offre</button>
        </div>
        <div>
          <p className="footer-title">ProAvenir</p>
          <button onClick={() => go("home")}>Accueil</button>
          <button onClick={() => go("login")}>Se connecter</button>
          <button onClick={() => go("register")}>Créer un compte</button>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © 2026 ProAvenir. Conçu pour rapprocher les talents en Guinée.
      </div>
    </footer>
  );
}
