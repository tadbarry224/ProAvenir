import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Check,
  FileText,
  MapPin,
  Plus,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { Job } from "../types/offer";
import type { Page } from "../types/navigation";
import { JobLogo } from "../components/jobs/JobLogo";
import { JobCard } from "../components/jobs/JobCard";
import { Footer } from "../components/layout/Footer";

export function Home({
  jobs,
  go,
  selectJob,
  setSearch,
  setCity,
}: {
  jobs: Job[]; // offres publiques uniquement (publiées et non expirées)
  go: (page: Page) => void;
  selectJob: (job: Job) => void;
  setSearch: (value: string) => void;
  setCity: (value: string) => void;
}) {
  const [heroSearch, setHeroSearch] = useState("");
  const [heroCity, setHeroCity] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(heroSearch);
    setCity(heroCity);
    go("jobs");
  };
  return (
    <>
      <main>
        <section className="hero-section overflow-hidden">
          <div className="hero-grid" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="page-shell relative grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> Votre avenir commence ici
              </span>
              <h1 className="font-display mt-6 max-w-3xl text-[43px] font-extrabold leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl">
                Le talent rencontre <span className="text-[#53d6aa]">l’opportunité.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Découvrez des stages et emplois en Guinée, postulez simplement et suivez chaque
                étape de votre candidature.
              </p>
              <form onSubmit={submit} className="search-panel mt-9">
                <label className="search-field">
                  <Search size={20} className="text-[#1768c4]" />
                  <span>
                    <small>Quel poste ?</small>
                    <input
                      value={heroSearch}
                      onChange={(e) => setHeroSearch(e.target.value)}
                      placeholder="Métier, compétence..."
                    />
                  </span>
                </label>
                <label className="search-field border-t sm:border-l sm:border-t-0">
                  <MapPin size={20} className="text-[#1768c4]" />
                  <span>
                    <small>Où ?</small>
                    <select value={heroCity} onChange={(e) => setHeroCity(e.target.value)}>
                      <option value="">Toute la Guinée</option>
                      <option>Conakry</option>
                      <option>Kindia</option>
                      <option>Labé</option>
                    </select>
                  </span>
                </label>
                <button className="btn-primary h-14 sm:h-[58px]" type="submit">
                  <Search size={18} /> Rechercher
                </button>
              </form>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={() => go("jobs")} className="btn-primary">
                  <BriefcaseBusiness size={17} /> Trouver un emploi
                </button>
                <button onClick={() => go("company")} className="btn-secondary">
                  <Plus size={17} /> Publier une offre
                </button>
              </div>
              <div className="hero-proof">
                <div>
                  <strong>6</strong>
                  <span>offres à découvrir</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>villes représentées</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>suivi transparent</span>
                </div>
              </div>
            </div>
            <div className="relative hidden min-h-[470px] lg:block">
              <div className="hero-visual">
                <div className="visual-head">
                  <span className="flex items-center gap-2 text-sm font-bold text-[#0c2340]">
                    <BriefcaseBusiness size={17} className="text-[#15966f]" /> Opportunités pour
                    vous
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                    NOUVEAU
                  </span>
                </div>
                {jobs.slice(0, 3).map((job, i) => (
                  <div className={`visual-job ${i === 1 ? "visual-job-active" : ""}`} key={job.id}>
                    <JobLogo job={job} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0c2340]">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {job.company} · {job.city}
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-slate-300" />
                  </div>
                ))}
                <div className="mt-4 rounded-xl bg-[#f3faf7] p-4">
                  <div className="flex justify-between text-xs font-semibold text-[#126f55]">
                    <span>Profil complété</span>
                    <span>85%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-emerald-100">
                    <div className="h-full w-[85%] rounded-full bg-[#15966f]" />
                  </div>
                </div>
              </div>
              <div className="float-card float-card-top">
                <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check size={17} />
                </span>
                <span>
                  <b>Profil vérifié</b>
                  <small>Prêt à postuler</small>
                </span>
              </div>
              <div className="float-card float-card-bottom">
                <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-blue-700">
                  <UsersRound size={17} />
                </span>
                <span>
                  <b>+120 talents</b>
                  <small>sur la plateforme</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Dernières opportunités</span>
              <h2>Des offres qui vous ressemblent</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Des opportunités claires, accessibles et pensées pour faire avancer votre parcours.
              </p>
            </div>
            <button onClick={() => go("jobs")} className="text-link hidden sm:flex">
              Voir toutes les offres <ArrowRight size={16} />
            </button>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {jobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} onClick={() => selectJob(job)} />
            ))}
          </div>
          <button onClick={() => go("jobs")} className="btn-secondary mt-7 w-full sm:hidden">
            Voir toutes les offres
          </button>
        </section>

        <section className="bg-[#f5f8fb] py-16 sm:py-20">
          <div className="page-shell">
            <div className="text-center">
              <span className="section-kicker">Simple et transparent</span>
              <h2 className="section-title">Votre prochaine étape en 3 temps</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [
                  Search,
                  "01",
                  "Trouvez une offre",
                  "Recherchez par métier, domaine, ville ou type de contrat.",
                ],
                [
                  FileText,
                  "02",
                  "Postulez simplement",
                  "Complétez votre profil, ajoutez votre CV et envoyez votre candidature.",
                ],
                [
                  BarChart3,
                  "03",
                  "Suivez sa progression",
                  "Consultez le statut de chaque candidature depuis votre espace.",
                ],
              ].map(([Icon, num, title, text]) => {
                const IconComponent = Icon as typeof Search;
                return (
                  <div className="step-card" key={num as string}>
                    <span className="step-number">{num as string}</span>
                    <span className="step-icon">
                      <IconComponent size={23} />
                    </span>
                    <h3>{title as string}</h3>
                    <p>{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="page-shell py-16 sm:py-20">
          <div className="cta-panel">
            <div className="relative z-10">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200">
                POUR LES ENTREPRISES
              </span>
              <h2 className="font-display mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
                Trouvez les talents qui feront avancer votre entreprise.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                Publiez vos offres et gérez toutes les candidatures depuis un espace unique et
                simple.
              </p>
              <button
                onClick={() => go("company")}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0c2340] transition hover:-translate-y-0.5"
              >
                Publier une offre <ArrowRight size={16} />
              </button>
            </div>
            <Building2 className="absolute -bottom-12 right-8 size-56 text-white/[0.04] sm:right-16 sm:size-72" />
          </div>
        </section>
      </main>
      <Footer go={go} />
    </>
  );
}
