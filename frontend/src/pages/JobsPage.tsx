import { useState } from "react";
import { CircleAlert, ListFilter, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { OFFER_TYPES, OFFER_TYPE_LABELS, type Job } from "../types/offer";
import { formatShortDate } from "../lib/dates";
import { JobCard } from "../components/jobs/JobCard";
import { usePublicOffers, useReferenceLists } from "../features/offers/usePublicOffers";

export function JobsPage({
  jobs,
  search,
  setSearch,
  city,
  setCity,
  selectJob,
}: {
  jobs: Job[]; // toutes les offres publiques (sert au nombre d'offres par type)
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
  // Les filtres sont appliqués par l'API (GET /api/offers). Les listes déroulantes
  // affichent les noms ; l'API attend les identifiants (« Boké » → « boke »).
  const references = useReferenceLists();
  const cities = references.data?.cities ?? [];
  const domains = references.data?.domains ?? [];
  const idOf = (items: { id: string; name: string }[], name: string) =>
    // Nom inconnu (ne devrait pas arriver) : on l'envoie tel quel, l'API répondra par une erreur.
    name ? (items.find((item) => item.name === name)?.id ?? name) : undefined;
  const results = usePublicOffers(
    references.data
      ? {
          city: idOf(cities, city),
          domain: idOf(domains, domain),
          type: OFFER_TYPES.find((value) => OFFER_TYPE_LABELS[value] === type),
          q: search,
        }
      : null, // on attend les villes et domaines
  );
  const filtered = results.jobs;
  const error = references.error ?? results.error;
  const loading = !error && results.status === "loading";
  const retry = () => (references.error ? references.reload() : results.reload());
  const filters = (
    <>
      <div className="filter-group">
        <label>Ville</label>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map((x) => (
            <option key={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>Domaine</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">Tous les domaines</option>
          {domains.map((x) => (
            <option key={x.id}>{x.name}</option>
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
                {error ? (
                  "Offres indisponibles"
                ) : loading ? (
                  "Chargement des offres…"
                ) : (
                  <>
                    {filtered.length} offre{filtered.length !== 1 ? "s" : ""} disponible
                    {filtered.length !== 1 ? "s" : ""}
                  </>
                )}
              </h2>
              {results.today && !loading && !error && (
                <p className="mt-1 text-xs text-slate-400">
                  {/* Date du serveur utilisée pour masquer les offres expirées. */}
                  Offres ouvertes au {formatShortDate(results.today)}
                </p>
              )}
            </div>
            <button onClick={() => setMobileFilters(true)} className="btn-secondary px-3 lg:hidden">
              <ListFilter size={17} /> Filtres
            </button>
          </div>
          {error ? (
            <div className="empty-state" role="alert">
              <CircleAlert size={28} />
              <h3>Impossible de charger les offres</h3>
              <p>{error}</p>
              <button onClick={retry} className="btn-secondary mx-auto mt-4">
                Réessayer
              </button>
            </div>
          ) : loading ? (
            <div className="empty-state" role="status">
              <LoaderCircle size={28} className="animate-spin" />
              <h3>Chargement des offres…</h3>
              <p>Connexion au serveur ProAvenir.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} onClick={() => selectJob(job)} />
              ))}
            </div>
          )}
          {!error && !loading && !filtered.length && (
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
