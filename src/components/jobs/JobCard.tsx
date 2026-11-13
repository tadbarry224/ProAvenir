import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react";
import type { Job } from "../../types/offer";
import { JobLogo } from "./JobLogo";

export function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  return (
    <article
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      tabIndex={0}
      role="button"
      className="job-card group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <div className="flex items-start justify-between gap-4">
        <JobLogo job={job} />
        <div className="flex items-center gap-2">
          {job.featured && <span className="pill bg-amber-50 text-amber-700">À la une</span>}
          <span className={`pill ${job.type === "Stage" ? "pill-green" : "pill-blue"}`}>
            {job.type}
          </span>
        </div>
      </div>
      <h3 className="mt-5 text-[17px] font-bold tracking-[-0.02em] text-[#0c2340] group-hover:text-[#1768c4]">
        {job.title}
      </h3>
      <p className="mt-1 text-sm font-medium text-slate-500">{job.company}</p>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <MapPin size={14} />
          {job.city}
        </span>
        <span className="flex items-center gap-1.5">
          <BriefcaseBusiness size={14} />
          {job.contract.split(" · ")[0]}
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
        <span>{job.posted}</span>
        <span className="flex items-center gap-1 font-bold text-[#1768c4]">
          Voir l’offre <ArrowRight size={14} />
        </span>
      </div>
    </article>
  );
}
