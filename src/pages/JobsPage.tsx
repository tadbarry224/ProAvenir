import { useMemo, useState } from "react";
import { ListFilter, Search, SlidersHorizontal, X } from "lucide-react";
import { OFFER_CITIES, OFFER_DOMAINS, type Job } from "../types/offer";
import { formatShortDate, todayIsoDate } from "../lib/dates";
import { JobCard } from "../components/jobs/JobCard";

export function JobsPage({
  jobs,
  search,
  setSearch,
  city,
  setCity,
  selectJob,
}: {
  jobs: Job[]; // offres publiques uniquement (publiées et non expirées)
  search: string;
  setSearch: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  selectJob: (job: Job) => void;
}) {
  const [draftSearch, setDraftSearch] = useState(search);
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const matchSearch = `${job.title} ${job.company} ${job.skills.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return (
          matchSearch &&
          (!city || job.city === city) &&
          (!domain || job.domain === domain) &&
          (!type || job.type === type)
        );
      }),
    [jobs, search, city, domain, type],
  );
  const filters = (
    <>
      <div className="filter-group">
        <label>Ville</label>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {OFFER_CITIES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Domaine</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">Tous les domaines</option>
          {OFFER_DOMAINS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Type d’opportunité</label>
        <div className="space-y-2">
          {["Stage", "Emploi"].map((x) => (
            <label key={x} className="check-row">
              <input
                type="checkbox"
                name="type"
                checked={type === x}
                onChange={() => setType(type === x ? "" : x)}
              />
              <span>{x}</span>
              <small>{jobs.filter((j) => j.type === x).length}</small>
            </label>
          ))}
        </div>
      </div>
      {(city || domain || type) && (
        <button
          onClick={() => {
            setCity("");
            setDomain("");
            setType("");
          }}
          className="w-full text-center text-xs font-bold text-[#1768c4]"
        >
          Réinitialiser les filtres
        </button>
      )}
    </>
  );
  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <section className="jobs-masthead py-11">
        <div className="page-shell">
          <span className="section-kicker">Explorez les opportunités</span>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">
            Trouvez l’offre faite pour vous
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            Explorez des stages et emplois adaptés à votre parcours en Guinée.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draftSearch);
            }}
            className="jobs-search mt-7 flex max-w-3xl gap-2 rounded-2xl border border-white/20 bg-white p-2"
          >
            <label className="flex flex-1 items-center gap-3 px-3">
              <Search size={19} className="text-slate-400" />
              <input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                className="w-full py-2 text-sm outline-none"
                placeholder="Poste, compétence ou entreprise..."
              />
            </label>
            <button type="submit" className="btn-primary px-5">
              <span className="hidden sm:inline">Rechercher</span>
              <Search size={17} className="sm:hidden" />
            </button>
          </form>
        </div>
      </section>
      <div className="page-shell grid gap-8 py-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:block">
          <div className="mb-6 flex items-center gap-2 font-bold text-[#0c2340]">
            <SlidersHorizontal size={17} /> Filtres
          </div>
          {filters}
        </aside>
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0c2340]">
                {filtered.length} offre{filtered.length !== 1 ? "s" : ""} disponible
                {filtered.length !== 1 ? "s" : ""}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {/* Date réelle utilisée pour masquer les offres expirées (voir offerRules). */}
                Données fictives — offres ouvertes au {formatShortDate(todayIsoDate())}
              </p>
            </div>
            <button onClick={() => setMobileFilters(true)} className="btn-secondary px-3 lg:hidden">
              <ListFilter size={17} /> Filtres
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => selectJob(job)} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Search size={28} />
              <h3>Aucune offre trouvée</h3>
              <p>Essayez de modifier votre recherche ou vos filtres.</p>
            </div>
          )}
        </section>
      </div>
      {mobileFilters && (
        <div className="modal-backdrop">
          <div className="mobile-sheet">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold">Filtrer les offres</h3>
              <button onClick={() => setMobileFilters(false)} className="icon-button">
                <X size={19} />
              </button>
            </div>
            {filters}
            <button onClick={() => setMobileFilters(false)} className="btn-primary mt-4 w-full">
              Afficher {filtered.length} offre(s)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
