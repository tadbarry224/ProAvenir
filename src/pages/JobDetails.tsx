import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  X,
} from "lucide-react";
import type { Job } from "../types/offer";
import type { Page } from "../types/navigation";
import { JobLogo } from "../components/jobs/JobLogo";

export function JobDetails({
  job,
  go,
  applied,
  onApply,
}: {
  job: Job;
  go: (page: Page) => void;
  applied: boolean;
  onApply: () => void;
}) {
  const [modal, setModal] = useState(false);
  const apply = (e: FormEvent) => {
    e.preventDefault();
    onApply();
    setModal(false);
  };
  return (
    <main className="min-h-screen bg-[#f6f8fb] pb-16">
      <div className="page-shell py-6">
        <button onClick={() => go("jobs")} className="text-link">
          <ArrowLeft size={16} /> Retour aux offres
        </button>
      </div>
      <div className="page-shell grid items-start gap-7 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="job-detail-hero content-card p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <JobLogo job={job} large />
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <span className={`pill ${job.type === "Stage" ? "pill-green" : "pill-blue"}`}>
                    {job.type}
                  </span>
                  <span className="pill bg-slate-100 text-slate-600">{job.domain}</span>
                  <span className="pill bg-amber-50 text-amber-700">Donnée fictive</span>
                </div>
                <h1 className="font-display mt-3 text-2xl font-extrabold tracking-[-0.035em] text-[#0c2340] sm:text-3xl">
                  {job.title}
                </h1>
                <p className="mt-2 font-semibold text-slate-600">{job.company}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} />
                    {job.city}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BriefcaseBusiness size={15} />
                    {job.contract}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={15} />
                    {job.posted}
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section className="content-card p-6 sm:p-8">
            <h2 className="content-title">À propos de l’offre</h2>
            <p className="mt-4 leading-7 text-slate-600">{job.description}</p>
            <h2 className="content-title mt-8">Vos missions</h2>
            <ul className="detail-list">
              <li>
                Contribuer activement aux projets de l’équipe et proposer des solutions adaptées.
              </li>
              <li>
                Assurer un suivi régulier des activités et partager des comptes rendus clairs.
              </li>
              <li>Collaborer avec les différents interlocuteurs internes et externes.</li>
            </ul>
            <h2 className="content-title mt-8">Compétences recherchées</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span className="skill-tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <h2 className="content-title mt-8">Profil recherché</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Vous êtes motivé·e, rigoureux·se et souhaitez progresser dans un environnement
              professionnel stimulant. Une première expérience ou un projet académique pertinent
              sera apprécié.
            </p>
          </section>
        </div>
        <aside className="content-card sticky top-24 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Date limite</p>
          <p className="mt-2 flex items-center gap-2 font-bold text-[#0c2340]">
            <CalendarDays size={18} className="text-[#1768c4]" />
            {job.deadline}
          </p>
          <div className="my-5 h-px bg-slate-100" />
          {applied ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" />
              <p className="mt-2 text-sm font-bold text-emerald-800">Candidature envoyée</p>
              <p className="mt-1 text-xs text-emerald-700">
                Vous pouvez suivre son état depuis votre espace.
              </p>
            </div>
          ) : (
            <button onClick={() => setModal(true)} className="btn-primary w-full">
              Postuler maintenant <ArrowRight size={17} />
            </button>
          )}
          <button onClick={() => go("candidate")} className="btn-secondary mt-3 w-full">
            Voir mon profil
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            Votre CV sera visible uniquement par le recruteur concerné.
          </p>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <form onSubmit={apply} className="modal-card">
            <div className="flex items-start justify-between">
              <div>
                <span className="section-kicker">Candidature</span>
                <h2 className="mt-1 text-xl font-extrabold text-[#0c2340]">{job.title}</h2>
              </div>
              <button type="button" onClick={() => setModal(false)} className="icon-button">
                <X size={19} />
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <FileCheck2 className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">CV_Mariama_Diallo.pdf</p>
                  <p className="text-xs text-emerald-700">Votre CV actuel sera transmis</p>
                </div>
              </div>
            </div>
            <label className="form-label mt-5">
              Message au recruteur <span>(facultatif)</span>
              <textarea rows={4} placeholder="Présentez brièvement votre motivation..." />
            </label>
            <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <input required type="checkbox" className="mt-1 accent-[#15966f]" />
              Je confirme l’exactitude des informations de mon profil.
            </label>
            <button className="btn-primary mt-6 w-full">Envoyer ma candidature</button>
          </form>
        </div>
      )}
    </main>
  );
}
