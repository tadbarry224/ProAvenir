import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  GraduationCap,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Page } from "../types/navigation";
import { Logo } from "../components/layout/Logo";

export function AuthPage({ mode, go }: { mode: "login" | "register"; go: (page: Page) => void }) {
  const register = mode === "register";
  const [role, setRole] = useState<"candidate" | "company">("candidate");
  const [resetRequested, setResetRequested] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [authError, setAuthError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (register && password !== confirmation) {
      setAuthError("Les deux mots de passe doivent être identiques.");
      return;
    }
    setAuthError("");
    go(role === "candidate" ? "candidate" : "company");
  };
  return (
    <main className="auth-page">
      <div className="auth-brand-panel">
        <div className="relative z-10 max-w-md">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <GraduationCap size={25} />
          </span>
          <h1 className="font-display mt-8 text-4xl font-extrabold leading-tight tracking-[-0.04em]">
            {register ? "Construisez votre avenir professionnel." : "Heureux de vous revoir."}
          </h1>
          <p className="mt-5 leading-7 text-slate-300">
            {register
              ? "Rejoignez une communauté de talents et d’entreprises engagés pour l’emploi en Guinée."
              : "Retrouvez vos candidatures, vos offres et toutes vos opportunités en un seul endroit."}
          </p>
          <div className="mt-10 space-y-4">
            {[
              "Un profil professionnel clair",
              "Des opportunités adaptées",
              "Un suivi simple et transparent",
            ].map((x) => (
              <div className="flex items-center gap-3 text-sm font-semibold" key={x}>
                <span className="grid size-7 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check size={14} />
                </span>
                {x}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="w-full max-w-md">
          <Logo onClick={() => go("home")} />
          <h2 className="font-display mt-10 text-3xl font-extrabold tracking-[-0.04em] text-[#0c2340]">
            {register ? "Créer votre compte" : "Connexion"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {register
              ? "Quelques informations pour commencer."
              : "Saisissez vos identifiants pour continuer."}
          </p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">Je suis</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("candidate")}
                  className={`role-choice ${role === "candidate" ? "selected" : ""}`}
                >
                  <UserRound size={20} />
                  Candidat
                </button>
                <button
                  type="button"
                  onClick={() => setRole("company")}
                  className={`role-choice ${role === "company" ? "selected" : ""}`}
                >
                  <Building2 size={20} />
                  Entreprise
                </button>
              </div>
            </div>
            {register && (
              <label className="form-label">
                Nom complet
                <input
                  required
                  placeholder={role === "candidate" ? "Ex. Mariama Diallo" : "Ex. Ibrahima Camara"}
                />
              </label>
            )}
            {register && role === "company" && (
              <label className="form-label">
                Nom de l’entreprise
                <input required placeholder="Nom de votre organisation" />
              </label>
            )}
            <label className="form-label">
              Adresse e-mail
              <input required type="email" placeholder="vous@exemple.com" />
            </label>
            <label className="form-label">
              Mot de passe
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8 caractères minimum"
              />
            </label>
            {register && (
              <label className="form-label">
                Confirmer le mot de passe
                <input
                  required
                  minLength={8}
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Saisissez à nouveau le mot de passe"
                />
              </label>
            )}
            {authError && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                {authError}
              </p>
            )}
            {!register && (
              <div className="flex justify-between text-xs">
                <label className="flex gap-2 text-slate-500">
                  <input type="checkbox" /> Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => setResetRequested(true)}
                  className="font-bold text-[#1768c4]"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
            {resetRequested && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
                Un lien de réinitialisation fictif a été envoyé à l’adresse indiquée.
              </p>
            )}
            <button className="btn-primary w-full py-3.5">
              {register ? "Créer mon compte" : "Se connecter"} <ArrowRight size={17} />
            </button>
          </form>
          {!register && (
            <div className="demo-access">
              <p>Accès rapide à la démonstration</p>
              <div>
                <button onClick={() => go("candidate")}>
                  <UserRound size={14} /> Candidat
                </button>
                <button onClick={() => go("company")}>
                  <Building2 size={14} /> Entreprise
                </button>
                <button onClick={() => go("admin")}>
                  <ShieldCheck size={14} /> Admin
                </button>
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-slate-500">
            {register ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              onClick={() => go(register ? "login" : "register")}
              className="font-bold text-[#1768c4]"
            >
              {register ? "Se connecter" : "Créer un compte"}
            </button>
          </p>
          <button
            onClick={() => go("home")}
            className="mx-auto mt-8 flex items-center gap-2 text-xs font-semibold text-slate-400"
          >
            <ArrowLeft size={14} /> Retour à l’accueil
          </button>
        </div>
      </div>
    </main>
  );
}
